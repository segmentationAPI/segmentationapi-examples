# Redact.ai - Privacy Scrubber

![Redact.ai Showcase](../faces-redacted.png)

**Redact.ai** is a demo application that uses AI to automatically detect and redact sensitive information from images.

It leverages Grounded Segmentation to find specific objects (like "face", "license plate", or "credit card") and generates precise masks to censor them.

## Features

-   **Multi-Target Redaction**: Clean text prompts allow you to redact multiple categories at once (e.g., "face, license plate").
-   **Pixel-Perfect Accuracy**: Uses segmentation masks rather than bounding boxes for cleaner redaction.
-   **Secure Processing**: All processing happens via API; no images are stored permanently.

## Tech Stack

-   **Frontend**: React + Vite + TypeScript
-   **Styling**: Tailwind CSS
-   **API**: [Segmentation API](https://segmentationapi.com) (`/v1/ground` endpoint)

## Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure API Key**:
    Copy `.env` and add your key:
    ```bash
    VITE_API_KEY=your_key_here
    ```

3.  **Start Dev Server**:
    ```bash
    npm run dev
    ```

4.  **Open in Browser**:
    http://localhost:5173

## How it Works

1.  User selects categories (Faces, License Plates) or types a custom object.
2.  App sends a request to `/v1/ground` with the text prompt (e.g., "face. license plate").
3.  API returns segmentation masks for all found objects.
4.  App overlays a black layer using the alpha channel of the returned masks to redact the content.
