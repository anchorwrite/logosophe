import React from 'react'

interface ContentPageProps {
  params: {
    lang: string
  }
}

export default function ContentPage({ params }: ContentPageProps) {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">
        Content - {params.lang}
      </h1>
      <p className="text-gray-600">
        This is the public content section for language: {params.lang}
      </p>
    </div>
  )
} 