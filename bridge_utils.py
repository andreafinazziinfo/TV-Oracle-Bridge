"""
bridge_utils.py — Shared utilities for TV-Oracle-Bridge Python modules.

Centralizes:
  - UTF-8 stdout reconfiguration (replaces boilerplate in 6 files)
  - Input sanitization for file paths and URLs
  - Common constants
"""

import sys
import re
from pathlib import Path
from urllib.parse import urlparse


def init_io():
    """Reconfigure stdout to UTF-8 on Windows to prevent UnicodeEncodeError with emojis."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


# Project root directory
ORACLE_DIR = Path(__file__).parent.resolve()

# Allowed characters in indicator keys and filenames
_SAFE_KEY_RE = re.compile(r'^[a-zA-Z0-9_\-]+$')

# Allowed URL schemes
_ALLOWED_SCHEMES = {"http", "https"}

# Allowed URL domains for TradingView operations
_ALLOWED_DOMAINS = {
    "tradingview.com",
    "www.tradingview.com",
    "scanner.tradingview.com",
}


def sanitize_key(key: str) -> str:
    """Validate and sanitize an indicator key or filename component.
    
    Rejects any key containing path traversal characters (.. / \\) or
    characters outside [a-zA-Z0-9_-].
    
    Args:
        key: The indicator key or filename component to validate.
        
    Returns:
        The validated key string (unchanged if valid).
        
    Raises:
        ValueError: If the key contains invalid characters.
    """
    if not key or not key.strip():
        raise ValueError("Key cannot be empty.")
    
    cleaned = key.strip()
    
    if ".." in cleaned or "/" in cleaned or "\\" in cleaned:
        raise ValueError(f"Key contains path traversal characters: '{cleaned}'")
    
    if not _SAFE_KEY_RE.match(cleaned):
        raise ValueError(
            f"Key contains invalid characters: '{cleaned}'. "
            f"Only alphanumeric, underscore, and hyphen are allowed."
        )
    
    return cleaned


def sanitize_path(file_path: str) -> str:
    """Validate and sanitize a file path for safe filesystem operations.
    
    Resolves the path and ensures it stays within the project's out/ directory
    or is an absolute path that doesn't escape via traversal.
    
    Args:
        file_path: The file path to validate.
        
    Returns:
        The resolved, validated path string.
        
    Raises:
        ValueError: If the path attempts directory traversal or is invalid.
    """
    if not file_path or not file_path.strip():
        raise ValueError("File path cannot be empty.")
    
    cleaned = file_path.strip()
    
    # Block obvious traversal patterns
    if ".." in cleaned:
        raise ValueError(f"Path contains directory traversal: '{cleaned}'")
    
    # Resolve to absolute path
    resolved = Path(cleaned).resolve()
    
    # Ensure it resolves within ORACLE_DIR
    try:
        resolved.relative_to(ORACLE_DIR)
    except ValueError:
        raise ValueError(
            f"Path '{cleaned}' resolves outside project directory."
        )
    
    return str(resolved)


def sanitize_url(url: str) -> str:
    """Validate and sanitize a URL for safe network operations.
    
    Ensures the URL uses http/https scheme and points to an allowed domain.
    
    Args:
        url: The URL to validate.
        
    Returns:
        The validated URL string (unchanged if valid).
        
    Raises:
        ValueError: If the URL scheme or domain is not allowed.
    """
    if not url or not url.strip():
        raise ValueError("URL cannot be empty.")
    
    cleaned = url.strip()
    
    try:
        parsed = urlparse(cleaned)
    except Exception:
        raise ValueError(f"Malformed URL: '{cleaned}'")
    
    if parsed.scheme not in _ALLOWED_SCHEMES:
        raise ValueError(
            f"URL scheme '{parsed.scheme}' is not allowed. "
            f"Use http or https."
        )
    
    hostname = (parsed.hostname or "").lower()
    
    # Check if hostname matches or is a subdomain of allowed domains
    is_allowed = any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in _ALLOWED_DOMAINS
    )
    
    if not is_allowed:
        raise ValueError(
            f"URL domain '{hostname}' is not in the allowed list. "
            f"Allowed: {', '.join(sorted(_ALLOWED_DOMAINS))}"
        )
    
    return cleaned
