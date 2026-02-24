interface VisionLabel {
  description: string;
  score: number;
}

interface VisionColor {
  color: { red: number; green: number; blue: number };
  score: number;
  pixelFraction: number;
}

interface VisionAnnotation {
  labelAnnotations?: VisionLabel[];
  imagePropertiesAnnotation?: {
    dominantColors?: {
      colors?: VisionColor[];
    };
  };
}

interface VisionResponse {
  responses?: VisionAnnotation[];
}

interface AnalysisResult {
  title: string;
  category: string;
}

function colorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  if (diff < 30 && max > 200) return 'White';
  if (max < 50) return 'Black';
  if (diff < 30) return 'Grey';

  if (r > g && r > b) {
    if (g > 150) return 'Yellow';
    if (b > 100) return 'Pink';
    return 'Red';
  }
  if (g > r && g > b) {
    if (r > 150) return 'Yellow-Green';
    return 'Green';
  }
  if (b > r && b > g) {
    if (r > 100) return 'Purple';
    return 'Blue';
  }

  return '';
}

export async function analyzeImage(
  base64: string
): Promise<AnalysisResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_VISION_API_KEY;

  if (__DEV__) {
    console.log(
      '[Vision] API key:',
      apiKey ? `${apiKey.slice(0, 10)}... (${apiKey.length} chars)` : 'NOT SET — set EXPO_PUBLIC_VISION_API_KEY in .env.local'
    );
  }

  if (!apiKey) return null;

  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 5 },
          { type: 'IMAGE_PROPERTIES', maxResults: 3 },
        ],
      },
    ],
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (__DEV__) {
    console.log('[Vision] Response status:', response.status, response.statusText);
  }

  if (!response.ok) {
    if (__DEV__) {
      const errBody = await response.text();
      console.log('[Vision] Error body:', errBody);
    }
    throw new Error(`Vision API error: ${response.status}`);
  }

  const data: VisionResponse = await response.json();

  if (__DEV__) {
    console.log('[Vision] Full response:', JSON.stringify(data, null, 2));
  }

  const annotation = data.responses?.[0];
  if (!annotation) {
    if (__DEV__) console.log('[Vision] No annotation in response — returning null');
    return null;
  }

  const topLabel = annotation.labelAnnotations?.[0]?.description ?? '';
  const category = topLabel;

  const dominantColor =
    annotation.imagePropertiesAnnotation?.dominantColors?.colors?.[0];
  let colorStr = '';
  if (dominantColor) {
    colorStr = colorName(
      dominantColor.color.red,
      dominantColor.color.green,
      dominantColor.color.blue
    );
  }

  const title = colorStr ? `${colorStr} ${topLabel}` : topLabel;

  if (__DEV__) {
    console.log('[Vision] Result → title:', title, '| category:', category);
  }

  return { title, category };
}
