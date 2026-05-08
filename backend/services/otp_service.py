"""
OTP helpers matching the CasaStay email OTP behavior.
"""

import hashlib
import secrets


def generate_otp() -> str:
    """Generate a six-digit numeric OTP."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(otp: str) -> str:
    """Hash an OTP with SHA-256. Plaintext OTPs are never stored."""
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def verify_otp_hash(otp: str, otp_hash: str) -> bool:
    """Constant-time comparison of a plaintext OTP against a SHA-256 hash."""
    return secrets.compare_digest(hash_otp(otp), otp_hash or "")
