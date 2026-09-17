================================================================================
HOW TO UPLOAD TO FILEZILLA (FIXING 403 FORBIDDEN ERRORS)
================================================================================

Why did you get a "403 Forbidden" error when you uploaded previously?
1. You likely uploaded the raw source code (`Onlineassessment-master` folder). Web servers (Apache/cPanel) cannot run raw React/Vite source code.
2. Web servers look for an `index.html` file. If they don't find one in the root folder, and directory listing is disabled, they throw a 403 Forbidden error!
3. React apps use client-side routing. Without an `.htaccess` file, going to `/login` or refreshing the page will cause a 404 or 403 error.

================================================================================
HOW TO UPLOAD CORRECTLY (STEP-BY-STEP)
================================================================================

Everything in this folder (`FILEZILLA_PUBLIC_HTML`) has been PRE-BUILT and is 100% ready to upload. 
It contains the compiled website and the necessary `.htaccess` file to make routing work and prevent 403 errors.

STEP 1: OPEN FILEZILLA
- Connect to your FTP/Web server using FileZilla.
- Navigate to your web root directory (usually named `public_html`, `htdocs`, or `/var/www/html`).

STEP 2: ENABLE HIDDEN FILES (IMPORTANT)
- In FileZilla, click on "Server" in the top menu bar.
- Ensure "Force showing hidden files" is CHECKED. 
- You MUST see the `.htaccess` file in this folder when uploading. Without it, you will still get errors!

STEP 3: UPLOAD
- On the left side of FileZilla (Local site), open this `FILEZILLA_PUBLIC_HTML` folder.
- Select ALL FILES inside this folder (including `.htaccess`, `index.html`, and the `assets/` folder).
- Drag and drop them into your server's `public_html` directory on the right side.

STEP 4: FIX FILE PERMISSIONS (If you still get 403 Forbidden after uploading)
Sometimes Windows/FileZilla uploads files with the wrong Linux permissions. To fix this:
1. In FileZilla (Right side / Remote site), Right-click the `public_html` folder (or select all uploaded files/folders).
2. Click "File permissions..."
3. Type `755` in the Numeric value box.
4. Check "Recurse into subdirectories".
5. Select "Apply to directories only", and click OK.
6. Right-click again -> "File permissions..."
7. Type `644` in the Numeric value box.
8. Check "Recurse into subdirectories".
9. Select "Apply to files only", and click OK.

================================================================================
Note: Your backend is connected!
The frontend has been compiled to connect to your Render backend API:
https://onlineassessment-hjjb.onrender.com/api
================================================================================
