# PS2 NET_EMU Patch Extractor

## Description

**Patch Extractor** is a Node.js application that processes binary files to extract patch information, converting it into .CONFIG, commonly used in PlayStation 2 emulators(NET_EMU). It features a web interface for uploading files and downloading processed patches.

> ⚠️ **Important Note**: This tool currently only extracts commands and convert NET_EMU -> GX_EMU.
> ## Features

- Extract patches from binary files
- Convert values to *big endian* and *little endian* formats
- Generate `.zip` output files automatically

## Technologies Used

- **Node.js** and **Express.js**: Backend and API routing -> https://nodejs.org/en/download/package-manager
- **Multer**: File upload handling
- **FS (File System)**: File management
- **Path**: File path handling
- **SimpleLogger**: Custom logging utility

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/LeonardoMeireles55/NetEmuPatchExtractor.git
   cd patch-extractor
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open the app in your browser at `http://localhost:3000`

## API Endpoints

### Process Hex File
- **Endpoint**: `POST /process-hex`
- **Description**: Processes a binary file and generates a patch file (extracts only `0x0A` commands)
- **Parameters**:
  - `file` (required): Binary file to be uploaded
- **Response Example**:
  ```json
  {
    "message": "Hex file processing completed.",
    "downloadLink": "/statics/output/converted_<file-name>.txt"
  }
  ```

## Project Structure

```plaintext
patch-extractor/
├── public/                # Static files (HTML, CSS, JS)
│   ├── index.html        # Main web interface
│   ├── styles.css        # Styling
│   └── script.js        # Frontend logic
├── src/
│   ├── controllers/
│   │   └── patch-controller.js    # API controller
│   ├── services/
│   │   └── patch-service.js       # Patch processing logic (0x0A extraction)
│   └── utils/
│       └── simple-logger.js       # Logging utility
├── statics/
│   ├── input/            # Directory for uploaded files
│   └── output/           # Directory for generated files
├── server.js             # Express server configuration
├── package.json          # Project configuration
└── README.md             # Documentation
```

## Usage Example

1. Open the app at `http://localhost:3000`
2. Select a binary file to upload
3. Click **"Extract Patches"** to process the file (only `0x0A` commands will be extracted)
4. Download the generated `.txt` file from the provided link

## Logs

Processing logs are saved to:
```
/log-file.log
```
