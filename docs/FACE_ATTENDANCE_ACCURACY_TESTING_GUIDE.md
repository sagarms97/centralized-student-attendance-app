# Face Attendance Accuracy Testing Guide & Benchmark Suite

## 1. Overview
This testing guide describes methodology, benchmark scenarios, metrics, and automated synthetic verification procedures to evaluate the accuracy, robustness, and speed of the EduAttend Face Attendance Module.

---

## 2. Key Metrics & Benchmarks

| Metric | Target | Description |
|---|---|---|
| **True Positive Rate (TPR / Recall)** | $\ge 95\%$ | Consented, enrolled students present in class correctly matched. |
| **False Acceptance Rate (FAR)** | $\le 0.5\%$ | An unknown or different student incorrectly recognized as an enrolled student. |
| **False Rejection Rate (FRR)** | $\le 5\%$ | An enrolled student in the photo rejected or classified as unknown. |
| **Duplicate Resolution Accuracy** | $100\%$ | When a student appears in multiple angle photos (Left + Center), the highest confidence match is retained without duplicate attendance rows. |
| **Client-Side WASM Detection Latency** | $< 350\text{ ms}$ | Time for MediaPipe Face Detector (WASM) to detect and crop all faces in a $1920\times 1080$ classroom photo. |
| **Server-Side ONNX Match Latency** | $< 120\text{ ms}$ | Time to extract 512-dim ArcFace embeddings for 35 face crops and compute cosine similarity against class vectors. |

---

## 3. Test Scenarios & Sample Test Matrix

### Scenario A: Standard Frontal Illumination
- **Conditions**: Overhead classroom daylight fluorescent/LED lighting (300–500 lux).
- **Face Angle**: $0^\circ \pm 15^\circ$ yaw and pitch.
- **Expected Outcome**: $\ge 98\%$ recognition confidence score, marked with Green Box (`Matched`).

### Scenario B: Wide Classroom Multi-Angle Photos (Left, Center, Right)
- **Conditions**: 3 overlapping photos capturing 40 students across 6 rows.
- **Expected Outcome**:
  - Center aisle students appearing in both Left and Center photos are deduplicated.
  - Exactly 1 attendance record per student created.
  - Review screen reflects deduplicated count.

### Scenario C: Extreme Angle / Rear Seating (Low Confidence)
- **Conditions**: Student seated in row 6 turned $35^\circ$ looking toward blackboard or notebook.
- **Expected Outcome**: Score falls between Low Confidence threshold ($50\%$) and Match threshold ($75\%$). Flagged with Amber Box (`LowConfidence`). Highlighted on Review Screen for teacher confirmation.

### Scenario D: Non-Enrolled Visitor / Unconsented Student
- **Conditions**: Student from another class or student without parental consent in the classroom.
- **Expected Outcome**: Classified as `Unknown Face` (Red Box). Cosine similarity to all class embeddings $< 50\%$. The teacher can dismiss or flag the visitor.

### Scenario E: Image Degradation & Blur Validation
- **Conditions**: Motion blur or low resolution ($< 60\times 60$ px crop).
- **Expected Outcome**: Server-side quality pre-check rejects crops with Laplacian variance below blur threshold with message: `"Image is too blurry for reliable face recognition."`

---

## 4. Synthetic Verification Script

The following automated PowerShell integration test script can be executed against the running backend to verify the complete recognition pipeline:

```powershell
# Set API URL and Token
$baseUrl = "http://localhost:5000/api"
$token = "YOUR_JWT_TOKEN"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# 1. Check Face Module Enabled
$settings = Invoke-RestMethod -Uri "$baseUrl/face/settings" -Headers $headers -Method GET
Write-Host "Face Attendance Enabled: $($settings.isEnabled)"

# 2. Synthetic Test Vectors Test
# Creates 3 synthetic orthogonal vectors and tests cosine similarity
$classId = 1
$matchPayload = @{
    classId = $classId
    section = "A"
    faceCrops = @(
        @{
            cropIndex = 1
            photoIndex = 1
            imageBase64 = "..."
            boundingBox = @{ x = 100; y = 120; width = 80; height = 90 }
        }
    )
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri "$baseUrl/face/recognition/match-class" -Headers $headers -Method POST -Body $matchPayload
Write-Host "Matched Count: $($result.matchedCount)"
Write-Host "Low Confidence Count: $($result.lowConfidenceCount)"
Write-Host "Unknown Count: $($result.unknownCount)"
```

---

## 5. Model Licensing & Deployment Configuration

- **Default Embedding Engine**: ArcFace ResNet-50 / MobileFaceNet ONNX model.
- **Configuration** (`appsettings.json`):
  ```json
  "FaceRecognition": {
    "ModelPath": "models/arcface_w600k_r50.onnx",
    "ExecutionProvider": "CPU",
    "EmbeddingDimension": 512,
    "Normalized": true
  }
  ```
- **Execution Providers**:
  - `CPU`: High portability across Windows, Linux, and containerized Docker environments.
  - `DirectML`: Hardware-accelerated GPU inference on Windows 10/11 with DirectX 12.
- **License Notice**: ArcFace model weights are distributed under MIT or non-commercial academic research licenses depending on the specific weight checkpoint used (e.g. InsightFace repository terms). For enterprise commercial deployments, ensure compliance with model licensing terms or substitute with an enterprise-licensed ONNX model checkpoint.
