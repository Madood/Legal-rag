#!/usr/bin/env python3
"""
Script to process PDF files in batch for the Legal RAG system.
"""

import os
import sys
import json
import shutil
from pathlib import Path
from typing import List, Dict, Optional, Any
import logging
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.services.pdf_service import PDFService
from PythonServices.app.services.embeddings.embedding_service import EmbeddingService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PDFProcessor:
    """Batch processor for PDF files"""
    
    def __init__(self, 
                 input_dir: str = "./data/pdfs",
                 output_dir: str = "./data/processed",
                 chunk_size: int = 800,
                 overlap: int = 100):
        
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.chunk_size = chunk_size
        self.overlap = overlap
        
        self.pdf_service = PDFService()
        self.embedding_service = EmbeddingService()
        
        # Ensure directories exist
        self.input_dir.mkdir(parents=True, exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Subdirectories for organization
        (self.output_dir / "by_statute").mkdir(exist_ok=True)
        (self.output_dir / "failed").mkdir(exist_ok=True)
    
    def find_pdf_files(self) -> List[Path]:
        """Find all PDF files in input directory"""
        pdf_files = list(self.input_dir.glob("**/*.pdf"))
        pdf_files += list(self.input_dir.glob("**/*.PDF"))
        return pdf_files
    
    def process_single_pdf(self, pdf_path: Path) -> Optional[Dict]:
        """Process a single PDF file"""
        try:
            logger.info(f"Processing: {pdf_path.name}")
            
            # Extract text and metadata
            text, metadata = self.pdf_service.extract_text(str(pdf_path))
            
            if not text or len(text.strip()) < 100:
                logger.warning(f"PDF has little or no text: {pdf_path.name}")
                return None
            
            # Chunk the text
            chunks = self.pdf_service.chunk_legal_text(
                text, 
                self.chunk_size, 
                self.overlap
            )
            
            if not chunks:
                logger.warning(f"No chunks created from: {pdf_path.name}")
                return None
            
            # Generate embeddings for chunks
            chunk_texts = [chunk["content"] for chunk in chunks]
            embeddings = self.embedding_service.embed_batch(chunk_texts)
            
            # Prepare result
            result = {
                "filename": pdf_path.name,
                "filepath": str(pdf_path.relative_to(self.input_dir)),
                "statute": metadata.statute,
                "language": metadata.language,
                "pages": metadata.pages,
                "text_length": len(text),
                "year": metadata.year,
                "jurisdiction": metadata.jurisdiction,
                "has_scanned_pages": metadata.has_scanned_pages,
                "is_ocr": metadata.is_ocr,
                "chunks_count": len(chunks),
                "chunks": chunks,
                "embeddings": [emb.tolist() for emb in embeddings],
                "processing_timestamp": metadata.timestamp.isoformat() if hasattr(metadata.timestamp, 'isoformat') else None
            }
            
            logger.info(f"Processed {pdf_path.name}: {len(chunks)} chunks, statute: {metadata.statute}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing {pdf_path.name}: {e}")
            return None
    
    def save_processed_result(self, result: Dict):
        """Save processed result to output directory"""
        if not result:
            return
        
        filename = result["filename"].replace(".pdf", "").replace(".PDF", "")
        statute = result.get("statute", "unknown")
        
        # Save to statute-specific directory
        statute_dir = self.output_dir / "by_statute" / statute
        statute_dir.mkdir(exist_ok=True)
        
        output_file = statute_dir / f"{filename}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        # Also save to main directory
        main_file = self.output_dir / f"{filename}.json"
        with open(main_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        logger.debug(f"Saved result to {output_file}")
    
    def move_processed_file(self, pdf_path: Path, success: bool = True):
        """Move processed PDF file to appropriate location"""
        processed_dir = self.input_dir / "processed"
        failed_dir = self.input_dir / "failed"
        
        processed_dir.mkdir(exist_ok=True)
        failed_dir.mkdir(exist_ok=True)
        
        if success:
            dest = processed_dir / pdf_path.name
        else:
            dest = failed_dir / pdf_path.name
        
        # Handle duplicate names
        counter = 1
        while dest.exists():
            stem = pdf_path.stem
            suffix = pdf_path.suffix
            dest = dest.parent / f"{stem}_{counter}{suffix}"
            counter += 1
        
        try:
            shutil.move(str(pdf_path), str(dest))
            logger.debug(f"Moved {pdf_path.name} to {dest.parent.name}")
        except Exception as e:
            logger.error(f"Error moving file {pdf_path.name}: {e}")
    
    def process_batch(self, max_workers: Optional[int] = None):
        """Process all PDF files in batch with parallel processing"""
        pdf_files = self.find_pdf_files()
        
        if not pdf_files:
            logger.warning(f"No PDF files found in {self.input_dir}")
            return
        
        logger.info(f"Found {len(pdf_files)} PDF files to process")
        
        # Determine number of workers
        if max_workers is None:
            max_workers = min(multiprocessing.cpu_count(), 4)  # Limit to 4 to avoid memory issues
        
        processed_count = 0
        failed_count = 0
        
        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            # Submit all processing tasks
            future_to_file = {
                executor.submit(self.process_single_pdf, pdf_file): pdf_file 
                for pdf_file in pdf_files
            }
            
            # Process results as they complete
            for future in as_completed(future_to_file):
                pdf_file = future_to_file[future]
                
                try:
                    result = future.result()
                    
                    if result:
                        self.save_processed_result(result)
                        self.move_processed_file(pdf_file, success=True)
                        processed_count += 1
                    else:
                        self.move_processed_file(pdf_file, success=False)
                        failed_count += 1
                        
                except Exception as e:
                    logger.error(f"Unexpected error processing {pdf_file.name}: {e}")
                    self.move_processed_file(pdf_file, success=False)
                    failed_count += 1
        
        # Generate summary report
        self.generate_summary_report(processed_count, failed_count, len(pdf_files))
        
        logger.info(f"Batch processing complete: {processed_count} succeeded, {failed_count} failed")
    
    def generate_summary_report(self, processed: int, failed: int, total: int):
        """Generate a summary report of the processing batch"""
        report = {
            "total_files": total,
            "processed_successfully": processed,
            "failed": failed,
            "success_rate": (processed / total * 100) if total > 0 else 0,
            "processing_settings": {
                "chunk_size": self.chunk_size,
                "overlap": self.overlap,
                "input_directory": str(self.input_dir),
                "output_directory": str(self.output_dir)
            },
            "statute_distribution": self.get_statute_distribution()
        }
        
        report_file = self.output_dir / "processing_summary.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Summary report saved to {report_file}")
        
        # Print summary to console
        print("\n" + "="*60)
        print("PDF PROCESSING SUMMARY")
        print("="*60)
        print(f"Total PDFs: {total}")
        print(f"Successfully processed: {processed}")
        print(f"Failed: {failed}")
        print(f"Success rate: {report['success_rate']:.1f}%")
        print("\nStatute distribution:")
        for statute, count in report['statute_distribution'].items():
            print(f"  {statute}: {count} documents")
        print("="*60)
    
    def get_statute_distribution(self) -> Dict[str, int]:
        """Get distribution of statutes in processed files"""
        statute_counts = {}
        
        # Count from existing JSON files
        json_files = list(self.output_dir.glob("*.json"))
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                statute = data.get("statute", "unknown")
                statute_counts[statute] = statute_counts.get(statute, 0) + 1
            except:
                continue
        
        return statute_counts
    
    def validate_processed_files(self) -> Dict[str, Any]:
        """Validate all processed files for consistency"""
        logger.info("Validating processed files...")
        
        json_files = list(self.output_dir.glob("*.json"))
        
        validation_results = {
            "total_files": len(json_files),
            "valid_files": 0,
            "invalid_files": 0,
            "errors": []
        }
        
        for json_file in json_files:
            try:
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Required fields
                required_fields = ["filename", "chunks", "statute"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    validation_results["errors"].append({
                        "file": json_file.name,
                        "error": f"Missing fields: {missing_fields}"
                    })
                    validation_results["invalid_files"] += 1
                    continue
                
                # Check chunks
                chunks = data.get("chunks", [])
                if not chunks:
                    validation_results["errors"].append({
                        "file": json_file.name,
                        "error": "No chunks found"
                    })
                    validation_results["invalid_files"] += 1
                    continue
                
                validation_results["valid_files"] += 1
                
            except Exception as e:
                validation_results["errors"].append({
                    "file": json_file.name,
                    "error": str(e)
                })
                validation_results["invalid_files"] += 1
        
        # Save validation report
        report_file = self.output_dir / "validation_report.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(validation_results, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Validation complete: {validation_results['valid_files']} valid, "
                   f"{validation_results['invalid_files']} invalid")
        
        return validation_results

def main():
    """Main function for command-line usage"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Batch process PDF files for Legal RAG system")
    parser.add_argument("--input-dir", default="./data/pdfs", help="Directory with PDF files")
    parser.add_argument("--output-dir", default="./data/processed", help="Directory for processed JSON files")
    parser.add_argument("--chunk-size", type=int, default=800, help="Chunk size in characters")
    parser.add_argument("--overlap", type=int, default=100, help="Overlap between chunks")
    parser.add_argument("--workers", type=int, help="Number of parallel workers (default: auto)")
    parser.add_argument("--single", help="Process single PDF file")
    parser.add_argument("--validate", action="store_true", help="Validate processed files")
    parser.add_argument("--stats", action="store_true", help="Show statistics")
    
    args = parser.parse_args()
    
    processor = PDFProcessor(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        chunk_size=args.chunk_size,
        overlap=args.overlap
    )
    
    if args.single:
        # Process single file
        pdf_path = Path(args.single)
        if not pdf_path.exists():
            # Try relative to input directory
            pdf_path = processor.input_dir / args.single
            
        if pdf_path.exists():
            result = processor.process_single_pdf(pdf_path)
            if result:
                processor.save_processed_result(result)
                processor.move_processed_file(pdf_path, success=True)
                print(f"Successfully processed {pdf_path.name}")
            else:
                print(f"Failed to process {pdf_path.name}")
        else:
            print(f"File not found: {args.single}")
    
    elif args.validate:
        results = processor.validate_processed_files()
        print(json.dumps(results, indent=2))
    
    elif args.stats:
        distribution = processor.get_statute_distribution()
        print("Statute distribution:")
        for statute, count in sorted(distribution.items(), key=lambda x: x[1], reverse=True):
            print(f"  {statute}: {count}")
    
    else:
        # Process batch
        processor.process_batch(max_workers=args.workers)

if __name__ == "__main__":
    main()