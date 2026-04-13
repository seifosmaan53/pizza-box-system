const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatStream(
  messages: ChatMessage[],
  accessToken: string | null,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        message: messages[messages.length - 1]?.content || '',
        history: messages.slice(0, -1),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError(errorText || `Request failed with status ${response.status}`);
      return;
    }

    if (!response.body) {
      onError('No response body received');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onDone();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text =
              parsed.choices?.[0]?.delta?.content ||
              parsed.delta?.text ||
              parsed.text ||
              '';
            if (text) onChunk(text);
          } catch {
            if (data) onChunk(data);
          }
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : 'An error occurred');
  }
}
