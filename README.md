# Segmentation API Examples

This repository contains example applications showcasing the capabilities of [Segmentation API](https://segmentationapi.com), powered by SAM 3.

These demos demonstrate how to use **Grounded Segmentation** (text-to-mask) for various real-world use cases.

## Included Examples

| Project                      | Description                                                                                                  | Use Case             |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------- |
| **[CountIt](./count-it)**    | Industrial inventory counter that detects and counts objects (e.g., pipes, rebar) from a single image.       | Inventory Management |
| **[Redact.ai](./redact-ai)** | Privacy tool that automatically detecting and redacting sensitive information like faces and license plates. | Privacy & Security   |

## Showcase

### CountIt - Automated Inventory Counting
![CountIt Showcase](./inventory-count.png)

### Redact.ai - Automatic PII Redaction
![Redact.ai Showcase](./faces-redacted.png)

## Getting Started

### Prerequisites
- Node.js (v18+)
- An API Key from [Segmentation API](https://segmentationapi.com)

### Running an Example
Navigate to any project folder and follow the standard Node.js workflow:

```bash
cd count-it  # or cd redact-ai
npm install
npm run dev
```

You will need to configure your `VITE_API_KEY` in the `.env` file of each project.
