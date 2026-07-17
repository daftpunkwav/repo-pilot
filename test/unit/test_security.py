"""安全工具单元测试"""
from backend.core.security import (
    create_access_token,
    create_refresh_token_value,
    decode_token,
    decrypt_secret,
    encrypt_secret,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_hash_and_verify_password():
    hashed = hash_password("demo1234")
    assert hashed != "demo1234"
    assert verify_password("demo1234", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_roundtrip():
    token = create_access_token({"sub": "user-1"})
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "user-1"


def test_refresh_token_hash_is_stable():
    plain = create_refresh_token_value()
    assert hash_refresh_token(plain) == hash_refresh_token(plain)
    assert len(hash_refresh_token(plain)) == 64


def test_encrypt_decrypt_secret_roundtrip():
    plain = "sk-test-secret-key-value"
    cipher = encrypt_secret(plain)
    assert cipher != plain
    assert cipher.startswith("enc:v1:")
    assert decrypt_secret(cipher) == plain


def test_decrypt_secret_plaintext_compat():
    """历史明文应原样返回，保证迁移兼容。"""
    assert decrypt_secret("ghp_legacy_plain_token") == "ghp_legacy_plain_token"
    assert decrypt_secret(None) is None
    assert decrypt_secret("") == ""
