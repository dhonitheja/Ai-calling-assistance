import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: bodyText,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Anthropic API error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Claude API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing Claude request.' },
      { status: 500 }
    );
  }
}
