# CountIt - Industrial Inventory Counter

![CountIt Showcase](../inventory-count.png)

**CountIt** is a demo application that showcases how to use **Grounded Segmentation** to count repeated objects in an image.

By simply describing an object (e.g., "bucket", "rebar", "pipe"), the application uses the Segmentation API to detect every instance, return its bounding box and segmentation mask, and display a total count.

## Features

-   **Natural Language Counting**: Count hundreds of objects with a single text prompt.
-   **Visual Verification**: Overlays semi-transparent masks and numbered badges on every detected object.
-   **No Training Required**: Uses zero-shot segmentation (SAM 3) to detect objects it has never seen before.

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

The app sends a JSON payload to the `/v1/ground` endpoint:

```json
{
  "image": "base64_string...",
  "text": "bucket",
  "action": "ground"
}
```

The API returns a list of masks and bounding boxes, which are then rendered onto an HTML Canvas element.
