'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Box, Card, Text, Button, TextArea, Flex, Badge } from '@radix-ui/themes';
import { StarFilledIcon, StarIcon } from '@radix-ui/react-icons';

interface Rating {
  Id: number;
  ContentType: string;
  ContentId: number;
  RaterEmail?: string;
  RaterName: string;
  Rating: number;
  Review?: string;
  Language: string;
  IsVerified: boolean;
  Status: string;
  CreatedAt: string;
  UpdatedAt: string;
}

interface RatingAnalytics {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: { [key: number]: number };
  lastCalculated: string | null;
}

interface BlogRatingsProps {
  blogPostId: number;
  handleName: string;
  onRatingAdded?: () => void;
}

const BlogRatings: React.FC<BlogRatingsProps> = ({ 
  blogPostId, 
  handleName, 
  onRatingAdded 
}) => {
  const { data: session } = useSession();
  const { t } = useTranslation('translations');
  
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [analytics, setAnalytics] = useState<RatingAnalytics>({
    averageRating: 0,
    totalRatings: 0,
    ratingDistribution: {},
    lastCalculated: null
  });
  const [loading, setLoading] = useState(false);
  const [newRating, setNewRating] = useState(0);
  const [newReview, setNewReview] = useState('');
  const [raterName, setRaterName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [userRating, setUserRating] = useState<Rating | null>(null);

  useEffect(() => {
    fetchRatings();
  }, [blogPostId]);

  useEffect(() => {
    // Set rater name from session if available
    if (session?.user?.name) {
      setRaterName(session.user.name);
    }
  }, [session]);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/ratings`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: { ratings: Rating[]; analytics: RatingAnalytics } };
        if (data.success) {
          setRatings(data.data.ratings);
          setAnalytics(data.data.analytics);
          
          // Check if current user has already rated
          if (session?.user?.email) {
            const existingRating = data.data.ratings.find(r => r.RaterEmail === session.user.email);
            setUserRating(existingRating || null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStarClick = (starValue: number) => {
    setNewRating(starValue);
  };

  const handleSubmitRating = async () => {
    if (!newRating || !raterName.trim() || !session?.user?.email) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: newRating,
          review: newReview.trim() || undefined,
          raterName: raterName.trim(),
          language: 'en' // Default to English for now
        })
      });

      if (response.ok) {
        // Create a temporary user rating object from the form data
        const newUserRating: Rating = {
          Id: Date.now(), // Temporary ID
          ContentType: 'blog_post',
          ContentId: blogPostId,
          RaterEmail: session.user.email,
          RaterName: raterName.trim(),
          Rating: newRating,
          Review: newReview.trim() || undefined,
          Language: 'en',
          IsVerified: false,
          Status: 'pending',
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
        };
        
        // Update the userRating state immediately
        setUserRating(newUserRating);
        
        setNewRating(0);
        setNewReview('');
        fetchRatings();
        onRatingAdded?.();
      } else {
        const errorData = await response.json();
        console.error('Error creating rating:', (errorData as any).error);
        // You could add error handling UI here
      }
    } catch (error) {
      console.error('Error adding rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false, onClick?: (value: number) => void) => {
    return (
      <Flex gap="1" align="center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Box
            key={star}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            onClick={() => interactive && onClick?.(star)}
          >
            {star <= rating ? (
              <StarFilledIcon style={{ color: '#fbbf24', width: 16, height: 16 }} />
            ) : (
              <StarIcon style={{ color: '#d1d5db', width: 16, height: 16 }} />
            )}
          </Box>
        ))}
      </Flex>
    );
  };

  if (loading) {
    return (
      <Box>
        <Text color="gray">{t('subscriber_pages.ratings.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex align="center" gap="2" mb="4">
        <StarFilledIcon style={{ color: '#fbbf24', width: 20, height: 20 }} />
        <Text size="4" weight="bold">
          {t('subscriber_pages.ratings.title')} ({analytics.totalRatings})
        </Text>
      </Flex>

      {/* Rating Summary */}
      {analytics.totalRatings > 0 && (
        <Card style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <Flex align="center" gap="3" mb="2">
            <Text size="6" weight="bold">
              {analytics.averageRating.toFixed(1)}
            </Text>
            {renderStars(Math.round(analytics.averageRating))}
            <Text size="2" color="gray">
              ({analytics.totalRatings} {t('subscriber_pages.ratings.total_ratings')})
            </Text>
          </Flex>
          
          {/* Rating Distribution */}
          <Flex gap="2" wrap="wrap">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = analytics.ratingDistribution[star] || 0;
              const percentage = analytics.totalRatings > 0 ? (count / analytics.totalRatings) * 100 : 0;
              return (
                <Flex key={star} align="center" gap="1">
                  <Text size="1">{star}★</Text>
                  <Box style={{ width: 60, height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 }}>
                    <Box 
                      style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        backgroundColor: '#fbbf24', 
                        borderRadius: 4 
                      }} 
                    />
                  </Box>
                  <Text size="1" color="gray">{count}</Text>
                </Flex>
              );
            })}
          </Flex>
        </Card>
      )}

      {/* New Rating Form */}
      {session?.user?.email && !userRating ? (
        <Card style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <Text weight="bold" style={{ marginBottom: 'var(--space-2)' }}>
            {t('subscriber_pages.ratings.add_rating')}
          </Text>
          
          {/* Star Rating Selection */}
          <Box mb="3">
            <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.select_rating')}
            </Text>
            {renderStars(newRating, true, handleStarClick)}
            {newRating > 0 && (
              <Text size="2" color="gray" style={{ marginTop: 'var(--space-1)' }}>
                {t('subscriber_pages.ratings.selected_rating', { rating: newRating })}
              </Text>
            )}
          </Box>

          {/* Rater Name */}
          <Box mb="3">
            <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.your_name')}
            </Text>
            <input
              type="text"
              value={raterName}
              onChange={(e) => setRaterName(e.target.value)}
              placeholder={t('subscriber_pages.ratings.name_placeholder')}
              style={{
                width: '100%',
                padding: 'var(--space-2)',
                border: '1px solid var(--gray-6)',
                borderRadius: 'var(--radius-2)',
                fontSize: 'var(--font-size-2)'
              }}
            />
          </Box>

          {/* Optional Review */}
          <Box mb="3">
            <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.optional_review')}
            </Text>
            <TextArea
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              placeholder={t('subscriber_pages.ratings.review_placeholder')}
              rows={3}
              style={{ marginBottom: 'var(--space-3)' }}
            />
          </Box>

          <Button 
            onClick={handleSubmitRating}
            disabled={!newRating || !raterName.trim() || submitting}
          >
            {submitting ? t('subscriber_pages.ratings.submitting') : t('subscriber_pages.ratings.submit')}
          </Button>
        </Card>
      ) : !session?.user?.email ? (
        <Card style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <Box style={{ textAlign: 'center' }}>
            <Text weight="bold" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.sign_in_required')}
            </Text>
            <Text size="2" color="gray" style={{ marginBottom: 'var(--space-3)', display: 'block' }}>
              {t('subscriber_pages.ratings.sign_in_description')}
            </Text>
            <Button asChild>
              <a href={`/signin?redirectTo=${encodeURIComponent(window.location.pathname)}`}>
                {t('common.sign_in')}
              </a>
            </Button>
          </Box>
        </Card>
      ) : userRating && (
        <Card style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <Box style={{ textAlign: 'center' }}>
            <Text weight="bold" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.already_rated')}
            </Text>
            <Text size="2" color="gray" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
              {t('subscriber_pages.ratings.your_rating')}
            </Text>
            {renderStars(userRating.Rating)}
            {userRating.Review && (
              <Text size="2" color="gray" style={{ marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                "{userRating.Review}"
              </Text>
            )}
          </Box>
        </Card>
      )}

      {/* Ratings List */}
      {ratings.length === 0 ? (
        <Box style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <Text color="gray">{t('subscriber_pages.ratings.no_ratings')}</Text>
        </Box>
      ) : (
        <Box>
          {ratings.map((rating) => (
            <Card key={rating.Id} style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)' }}>
              <Flex align="center" gap="2" mb="2">
                <Text weight="bold">{rating.RaterName}</Text>
                {rating.IsVerified && (
                  <Badge color="green" variant="soft">
                    {t('subscriber_pages.ratings.verified')}
                  </Badge>
                )}
                <Text size="1" color="gray">
                  {new Date(rating.CreatedAt).toLocaleDateString()}
                </Text>
              </Flex>
              
              {renderStars(rating.Rating)}
              
              {rating.Review && (
                <Text size="2" style={{ marginTop: 'var(--space-2)', fontStyle: 'italic' }}>
                  "{rating.Review}"
                </Text>
              )}
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default BlogRatings;
