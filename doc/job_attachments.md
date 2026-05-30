# Job attachment contract

Job attachments currently store metadata for files hosted in external storage.
The API does not accept multipart binary uploads yet.

Endpoint:

```text
POST /api/jobs/jobs/{id}/attachments/
```

Required fields:

- `file_name`: visible file name, including extension
- `file_url`: HTTPS URL to the externally stored file

Optional fields:

- `file_type`: MIME type
- `file_size`: client-provided size hint in bytes; validated up to 25 MiB and
  not persisted

Allowed MIME types:

- `application/pdf`
- `image/jpeg`
- `image/png`
- `image/webp`
- `model/stl`
- `model/obj`
- `model/ply`
- `application/sla`

Policy:

- URLs must use `https://`.
- If `file_type` is provided, the file extension must match the MIME type.
- Real binary upload support should be added as a separate storage-backed
  feature, with virus scanning and signed URLs.
