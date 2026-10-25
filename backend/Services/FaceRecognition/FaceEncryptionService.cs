using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace StudentAttendance.Api.Services.FaceRecognition;

public interface IFaceEncryptionService
{
    (byte[] Ciphertext, byte[] Iv, byte[] Tag) EncryptEmbedding(float[] embedding);
    float[] DecryptEmbedding(byte[] ciphertext, byte[] iv, byte[] tag);
}

public class FaceEncryptionService : IFaceEncryptionService
{
    private readonly byte[] _key;

    public FaceEncryptionService(IConfiguration configuration)
    {
        var keyConfig = configuration["FaceAttendance:EncryptionKey"];
        if (!string.IsNullOrEmpty(keyConfig))
        {
            try
            {
                var decoded = Convert.FromBase64String(keyConfig);
                if (decoded.Length == 32)
                {
                    _key = decoded;
                    return;
                }
            }
            catch
            {
                // Fallback to SHA256 derived key below
            }

            // Derive 32-byte key from string
            using var sha = SHA256.Create();
            _key = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(keyConfig));
        }
        else
        {
            // Default deterministic fallback key for dev/test
            using var sha = SHA256.Create();
            _key = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes("EduAttend_Default_Face_Encryption_Key_2026"));
        }
    }

    public (byte[] Ciphertext, byte[] Iv, byte[] Tag) EncryptEmbedding(float[] embedding)
    {
        if (embedding == null || embedding.Length == 0)
            throw new ArgumentException("Embedding cannot be null or empty", nameof(embedding));

        var byteCount = embedding.Length * sizeof(float);
        var plaintext = new byte[byteCount];
        Buffer.BlockCopy(embedding, 0, plaintext, 0, byteCount);

        var iv = new byte[AesGcm.NonceByteSizes.MaxSize]; // 12 bytes
        RandomNumberGenerator.Fill(iv);

        var tag = new byte[AesGcm.TagByteSizes.MaxSize]; // 16 bytes
        var ciphertext = new byte[plaintext.Length];

        using var aesGcm = new AesGcm(_key, AesGcm.TagByteSizes.MaxSize);
        aesGcm.Encrypt(iv, plaintext, ciphertext, tag);

        return (ciphertext, iv, tag);
    }

    public float[] DecryptEmbedding(byte[] ciphertext, byte[] iv, byte[] tag)
    {
        if (ciphertext == null || ciphertext.Length == 0)
            throw new ArgumentException("Ciphertext cannot be null or empty", nameof(ciphertext));

        var plaintext = new byte[ciphertext.Length];
        using var aesGcm = new AesGcm(_key, tag.Length);
        aesGcm.Decrypt(iv, ciphertext, tag, plaintext);

        var floatCount = plaintext.Length / sizeof(float);
        var embedding = new float[floatCount];
        Buffer.BlockCopy(plaintext, 0, embedding, 0, plaintext.Length);

        return embedding;
    }
}
