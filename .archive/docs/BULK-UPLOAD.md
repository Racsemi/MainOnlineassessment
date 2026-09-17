# BULK-UPLOAD.md

## Bulk Data Import Protocols

RACSEMI Assess supports bulk importing via CSV or XLSX to streamline onboarding for both Candidates and Questions.

### 1. Bulk Candidate Import
Candidate imports require strict header matching. Unrecognized columns are safely ignored, but required columns must be present.
**Format Supported**: `.csv`, `.xlsx`

**Required Columns**:
- `name`: Candidate's full name.
- `email`: Valid email address (used for invitation link delivery).

**Optional Columns**:
- `phone`: Contact number.
- `candidateIdentifier`: Unique internal applicant tracking ID.
- `tags`: Comma-separated tags (e.g., `campus-drive-2026`).

---

### 2. Bulk Question Import (MCQ)
MCQ questions can be uploaded directly into the Question Bank. The parser validates the rows strictly; any row failing validation (e.g., missing a correct answer, invalid question type) will skip insertion and return a row-specific error to the admin UI.

**Format Supported**: `.csv`, `.xlsx`

**Required Columns**:
- `question`: The main problem statement.
- `type`: Must be exactly `MCQ_SINGLE` or `MCQ_MULTIPLE`.
- `optionA`: The text for Option A.
- `optionB`: The text for Option B.
- `correctAnswer`: For single (e.g., `A`), for multiple (e.g., `A,C`).

**Optional Columns**:
- `optionC`, `optionD`, `optionE`: Additional choices.
- `explanation`: Displayed if post-assessment review is enabled.
- `category`: e.g., `Algorithms`, `DBMS`. Defaults to `General`.
- `difficulty`: `EASY`, `MEDIUM`, or `HARD`.
- `marks`: Positive numerical value.
- `negativeMarks`: Penalty for incorrect answers (e.g., `0.5`).
- `tags`: Comma-separated topics.

### Error Handling Protocol
The bulk importer processes rows transactionally. Validation ensures:
- Email regex compliance.
- No duplicate candidates per organization.
- Exact match on MCQ Correct Answer syntax.

Administrators will receive a UI summary outlining successful imports, duplicate skips, and specific row-level validation errors to correct in their spreadsheet.
