using StudentAttendance.Api.DTOs;

namespace StudentAttendance.Api.Services.FaceRecognition;

public interface IFaceRecognitionService
{
    Task<FaceQualityResult> AssessFaceQualityAsync(byte[] imageBytes);
    Task<float[]> GenerateEmbeddingAsync(byte[] imageBytes);
    double ComputeCosineSimilarity(float[] vectorA, float[] vectorB);
    Task<ClassRecognitionResultDto> MatchClassFacesAsync(
        int classId,
        string? section,
        List<FaceCropMatchRequest> crops,
        double matchThreshold,
        double lowConfidenceThreshold);
}
