from cryptography.fernet import Fernet
from app.core.config import settings

fernet = Fernet(settings.ENCRYPTION_KEY.encode())

def encrypt_string(plaintext: str) -> str:
    """Encrypts a string using Fernet symmetric encryption."""
    return fernet.encrypt(plaintext.encode()).decode()

def decrypt_string(ciphertext: str) -> str:
    """Decrypts a Fernet encrypted string."""
    return fernet.decrypt(ciphertext.encode()).decode()
