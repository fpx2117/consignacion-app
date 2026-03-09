#!/usr/bin/env python3
"""
Schema Validator - Database schema validation
Validates Prisma and Drizzle schemas for common issues and best practices.

Usage:
    python schema_validator.py <project_path>
"""

import sys
import json
import re
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Dict

def find_schema_files(project_path: Path) -> List[Tuple[str, Path]]:
    """Find database schema files for Prisma and Drizzle."""
    schemas = []
    
    # Prisma schemas
    prisma_files = list(project_path.glob('**/prisma/*.prisma'))
    schemas.extend([('prisma', f) for f in prisma_files])
    
    # Drizzle schema files
    drizzle_patterns = ['**/drizzle/*.ts', '**/schema/*.ts', '**/db/schema.ts']
    for pattern in drizzle_patterns:
        for f in project_path.glob(pattern):
            content_lower = f.name.lower()
            if any(k in content_lower for k in ['schema', 'table', 'models']):
                schemas.append(('drizzle', f))
    
    # Remove duplicates and limit
    unique_schemas = list({f.resolve(): (t, f) for t, f in schemas}.values())
    return unique_schemas[:15]

def validate_prisma_schema(file_path: Path) -> List[str]:
    """Validate Prisma schema file with improved regex and logic."""
    issues = []
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        # Remove comments for cleaner parsing
        clean_content = re.sub(r'//.*', '', content)
        
        models = re.findall(r'model\s+(\w+)\s*{([\s\S]*?)}', clean_content)
        
        for model_name, model_body in models:
            if not model_name[0].isupper():
                issues.append(f"Model '{model_name}' should use PascalCase")
            
            if '@id' not in model_body and '@@id' not in model_body:
                issues.append(f"Model '{model_name}' is missing a primary key (@id or @@id)")
            
            if not any(field in model_body for field in ['createdAt', 'created_at']):
                issues.append(f"Model '{model_name}' missing createdAt field")
                
            # Check for missing indexes on foreign keys
            fk_fields = re.findall(r'(\w+Id)\s+\w+', model_body)
            for fk in fk_fields:
                index_pattern = rf'@@index\(\[.*{fk}.*\]\)'
                if not re.search(index_pattern, model_body) and not re.search(rf'@unique', model_body):
                    issues.append(f"Consider adding @@index([{fk}]) in model '{model_name}'")

        enums = re.findall(r'enum\s+(\w+)\s*{', clean_content)
        for enum_name in enums:
            if not enum_name[0].isupper():
                issues.append(f"Enum '{enum_name}' should use PascalCase")
                
    except Exception as e:
        issues.append(f"Error parsing Prisma schema: {str(e)}")
    
    return issues

def validate_drizzle_schema(file_path: Path) -> List[str]:
    """Basic validation for Drizzle TypeScript schemas."""
    issues = []
    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        
        # Check for table definitions
        tables = re.findall(r'(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*["\'](\w+)["\']', content)
        
        for table_name in tables:
            if table_name != table_name.lower() and '_' not in table_name:
                # Drizzle convention usually favors snake_case for DB table names
                pass 
            
        if "primaryKey" not in content and "serial(" not in content and ".primaryKey()" not in content:
            issues.append(f"Schema {file_path.name} might be missing primary key definitions")
            
    except Exception as e:
        issues.append(f"Error parsing Drizzle schema: {str(e)}")
    return issues

def main():
    parser = argparse.ArgumentParser(description="Validate database schemas.")
    parser.add_argument("path", nargs="?", default=".", help="Project root path")
    args = parser.parse_args()
    
    project_path = Path(args.path).resolve()
    schemas = find_schema_files(project_path)
    
    results = []
    for stype, spath in schemas:
        validator = validate_prisma_schema if stype == 'prisma' else validate_drizzle_schema
        issues = validator(spath)
        if issues:
            results.append({"file": str(spath.relative_to(project_path)), "type": stype, "issues": issues})

    output = {
        "timestamp": datetime.now().isoformat(),
        "project": str(project_path),
        "files_scanned": len(schemas),
        "total_issues": sum(len(r["issues"]) for r in results),
        "results": results
    }
    
    print(json.dumps(output, indent=2))
    sys.exit(0)

if __name__ == "__main__":
    main()
```
