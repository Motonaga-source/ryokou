import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()
    const correctPassword = process.env.SITE_PASSWORD || '1022'

    if (password === correctPassword) {
      cookies().set({
        name: 'site-auth',
        value: 'true',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'パスワードが間違っています' },
      { status: 401 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'エラーが発生しました' },
      { status: 500 }
    )
  }
}
