"""Address parsing utilities for POI data processing."""

import re
from typing import Optional


def parse_street_address(freeform: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """
    Extract street name and house number from freeform address.
    
    Handles multiple international address formats:
    - English: "123 Main Street" → ("Main Street", "123")
    - Brazilian (comma): "Rua XV de Novembro, 123" → ("Rua XV de Novembro", "123")
    - Brazilian (no comma): "Avenida Paulista 1000" → ("Avenida Paulista", "1000")
    - No number: "Main St" → ("Main St", None)
    
    Args:
        freeform: Full address string from Overture Maps
        
    Returns:
        Tuple of (street_name, house_number)
    """
    if not freeform:
        return (None, None)
    
    freeform = freeform.strip()
    
    # Pattern 1: Number at start (English: "123 Main Street")
    match = re.match(r'^(\d+[\w/-]*)\s+(.+)$', freeform)
    if match:
        return (match.group(2), match.group(1))
    
    # Pattern 2: Number after comma (Brazilian: "Rua Nome, 123")
    match = re.match(r'^(.+?),\s*(\d+[\w/-]*)$', freeform)
    if match:
        return (match.group(1), match.group(2))
    
    # Pattern 3: Number at end (no comma: "Avenida Paulista 1000")
    match = re.match(r'^(.+?)\s+(\d+[\w/-]*)$', freeform)
    if match:
        street, number = match.group(1), match.group(2)
        # Only extract if clearly numeric (avoid "XV de Novembro" → "XV de", "Novembro")
        if number.isdigit() or re.match(r'^\d+[A-Za-z]?$', number):
            return (street, number)
    
    # No number found - return address as-is
    return (freeform, None)
