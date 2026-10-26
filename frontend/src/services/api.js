/**
 * VisionMate API Service
 * Encapsulates all network communication with the backend.
 * Contract:
 * POST {VITE_API_URL}/api/analyze
 * multipart/form-data: "image" (JPEG blob) and "question" (string)
 * Response: { "answer": string, "status": "success" }
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const REQUEST_TIMEOUT_MS = 20000;

/**
 * Generates an assistive mock response for offline testing.
 */
function getMockAnswer(question) {
  const q = (question || '').toLowerCase();
  if (q.includes('text') || q.includes('read') || q.includes('words')) {
    return "There is a printed sign that reads: 'Pharmacy Entrance, Open 9 AM to 6 PM'.";
  }
  if (q.includes('obstacle') || q.includes('floor') || q.includes('safe') || q.includes('walk')) {
    return "The path straight ahead is clear, with a low wooden chair situated about four feet to your right.";
  }
  if (q.includes('color') || q.includes('wearing')) {
    return "The primary colors are navy blue and off-white with clear contrasting edges.";
  }
  return "Directly in front of you is a clean tabletop with a white coffee cup and a closed notebook. The space is well-lit.";
}

/**
 * Sends image and question to the backend POST /api/analyze endpoint.
 *
 * @param {Blob} imageBlob - JPEG image blob
 * @param {string} question - User question
 * @returns {Promise<{ answer: string, status: string }>}
 */
export async function analyzeImage(imageBlob, question) {
  if (!question || !question.trim()) {
    throw new Error('A question must be provided for visual analysis.');
  }

  if (!imageBlob) {
    throw new Error('An image must be captured or provided.');
  }

  // 1. Mock Mode (for offline UI development or testing)
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      answer: getMockAnswer(question),
      status: 'success',
    };
  }

  // 2. Real Backend Network Call
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');
  formData.append('question', question.trim());

  try {
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/api/analyze`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = `Server returned status ${response.status}`;
      try {
        const errJson = await response.json();
        if (errJson.detail) detail = errJson.detail;
        else if (errJson.message) detail = errJson.message;
      } catch {
        // Not JSON
      }
      throw new Error(detail);
    }

    const data = await response.json();

    // Verify exact contract: { answer: string, status: "success" }
    if (data && data.status === 'success' && typeof data.answer === 'string') {
      return {
        answer: data.answer,
        status: data.status,
      };
    }

    throw new Error('Server response did not match expected VisionMate contract.');
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw new Error('Request timed out after 20 seconds. Please try again.');
    }

    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error(`Unable to reach VisionMate server at ${API_BASE_URL}. Please check your connection.`);
    }

    throw err;
  }
}

export { API_BASE_URL, USE_MOCK };
