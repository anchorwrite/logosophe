"use client";

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { 
  Box, 
  Flex, 
  Text, 
  TextArea, 
  Button, 
  Card, 
  Avatar, 
  Badge,
  Separator
} from '@radix-ui/themes';
import * as Dialog from '@radix-ui/react-dialog';
import { MessageCircle, Reply, Flag, Trash2, Edit3 } from 'lucide-react';

interface Comment {
  Id: number;
  BlogPostId: number;
  AuthorEmail: string;
  AuthorName: string;
  Content: string;
  ParentCommentId: number | null;
  Status: 'approved' | 'archived' | 'flagged';
  IsModerated: boolean;
  CreatedAt: string;
  UpdatedAt: string;
  replies?: Comment[];
}

interface BlogCommentsProps {
  blogPostId: number;
  handleName: string;
  onCommentAdded?: () => void;
}

const BlogComments: React.FC<BlogCommentsProps> = ({ 
  blogPostId, 
  handleName, 
  onCommentAdded 
}) => {
  const { t } = useTranslation('translations');
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<number | null>(null);

  useEffect(() => {
    fetchComments();
  }, [blogPostId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments`);
      if (response.ok) {
        const data = await response.json() as { success: boolean; data: Comment[] };
        if (data.success) {
          // Organize comments into threaded structure
          const organizedComments = organizeComments(data.data);
          setComments(organizedComments);
        }
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const organizeComments = (comments: Comment[]): Comment[] => {
    const commentMap = new Map<number, Comment>();
    const topLevelComments: Comment[] = [];

    // First pass: create map of all comments
    comments.forEach(comment => {
      commentMap.set(comment.Id, { ...comment, replies: [] });
    });

    // Second pass: organize into threaded structure
    comments.forEach(comment => {
      if (comment.ParentCommentId) {
        const parent = commentMap.get(comment.ParentCommentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentMap.get(comment.Id)!);
        }
      } else {
        topLevelComments.push(commentMap.get(comment.Id)!);
      }
    });

    return topLevelComments;
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !session?.user?.email) return;

    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment.trim(),
          parentCommentId: null
        })
      });

      if (response.ok) {
        setNewComment('');
        fetchComments();
        onCommentAdded?.();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleSubmitReply = async (parentCommentId: number) => {
    if (!replyContent.trim() || !session?.user?.email) return;

    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentCommentId
        })
      });

      if (response.ok) {
        setReplyContent('');
        setReplyingTo(null);
        fetchComments();
        onCommentAdded?.();
      }
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const handleEditComment = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent.trim()
        })
      });

      if (response.ok) {
        setEditContent('');
        setEditingComment(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Error editing comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setShowDeleteDialog(null);
        fetchComments();
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const handleFlagComment = async (commentId: number) => {
    try {
      const response = await fetch(`/api/pages/${handleName}/blog/${blogPostId}/comments/${commentId}/flag`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchComments();
      }
    } catch (error) {
      console.error('Error flagging comment:', error);
    }
  };

  const canModifyComment = (comment: Comment) => {
    return session?.user?.email === comment.AuthorEmail;
  };

  const canModerateComment = (comment: Comment) => {
    // TODO: Add proper role-based access control
    return session?.user?.email === comment.AuthorEmail;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <Box key={comment.Id} mb="3">
      <Card style={{ marginLeft: isReply ? '2rem' : '0' }}>
        <Flex gap="3" align="start">
          <Avatar 
            size="2" 
            src={`/api/avatars/${comment.AuthorEmail}`}
            fallback={comment.AuthorName?.charAt(0)?.toUpperCase() || '?'}
          />
          <Box style={{ flex: 1 }}>
            <Flex gap="2" align="center" mb="2">
              <Text weight="bold" size="2">{comment.AuthorName || 'Anonymous'}</Text>
              <Text size="1" color="gray">{formatDate(comment.CreatedAt)}</Text>
              {comment.Status !== 'approved' && (
                <Badge color="orange" size="1">
                  {t(`subscriber_pages.comments.status.${comment.Status}`)}
                </Badge>
              )}
            </Flex>
            
            {editingComment === comment.Id ? (
              <Box mb="3">
                <TextArea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder={t('subscriber_pages.comments.edit_placeholder')}
                  rows={3}
                />
                <Flex gap="2" mt="2">
                  <Button 
                    size="1" 
                    onClick={() => handleEditComment(comment.Id)}
                    disabled={!editContent.trim()}
                  >
                    {t('common.save')}
                  </Button>
                  <Button 
                    size="1" 
                    variant="soft" 
                    onClick={() => {
                      setEditingComment(null);
                      setEditContent('');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Flex>
              </Box>
            ) : (
              <Text size="2" mb="2">{comment.Content}</Text>
            )}

            <Flex gap="2" align="center">
              <Button 
                size="1" 
                variant="ghost" 
                onClick={() => setReplyingTo(replyingTo === comment.Id ? null : comment.Id)}
              >
                <Reply size={14} />
                {t('subscriber_pages.comments.reply')}
              </Button>
              
              {canModifyComment(comment) && (
                <>
                  <Button 
                    size="1" 
                    variant="ghost" 
                    onClick={() => {
                      setEditingComment(comment.Id);
                      setEditContent(comment.Content);
                    }}
                  >
                    <Edit3 size={14} />
                    {t('common.edit')}
                  </Button>
                  <Button 
                    size="1" 
                    variant="ghost" 
                    color="red"
                    onClick={() => setShowDeleteDialog(comment.Id)}
                  >
                    <Trash2 size={14} />
                    {t('common.delete')}
                  </Button>
                </>
              )}
              
              {canModerateComment(comment) && (
                <Button 
                  size="1" 
                  variant="ghost" 
                  color="orange"
                  onClick={() => handleFlagComment(comment.Id)}
                >
                  <Flag size={14} />
                  {t('subscriber_pages.comments.flag')}
                </Button>
              )}
            </Flex>

            {replyingTo === comment.Id && (
              <Box mt="3" p="3" style={{ backgroundColor: 'var(--gray-2)' }}>
                <TextArea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder={t('subscriber_pages.comments.reply_placeholder')}
                  rows={2}
                />
                <Flex gap="2" mt="2">
                  <Button 
                    size="1" 
                    onClick={() => handleSubmitReply(comment.Id)}
                    disabled={!replyContent.trim()}
                  >
                    {t('subscriber_pages.comments.submit_reply')}
                  </Button>
                  <Button 
                    size="1" 
                    variant="soft" 
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyContent('');
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                </Flex>
              </Box>
            )}

            {comment.replies && comment.replies.length > 0 && (
              <Box mt="3">
                <Separator mb="3" />
                {comment.replies.map(reply => renderComment(reply, true))}
              </Box>
            )}
          </Box>
        </Flex>
      </Card>
    </Box>
  );

  if (loading) {
    return (
      <Box style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <Text color="gray">{t('subscriber_pages.comments.loading')}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Flex align="center" gap="2" mb="4">
        <MessageCircle size={20} />
        <Text size="4" weight="bold">
          {t('subscriber_pages.comments.title')} ({comments.length})
        </Text>
      </Flex>

      {/* New Comment Form */}
      {session?.user?.email && (
        <Card style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <Text weight="bold" style={{ marginBottom: 'var(--space-2)' }}>
            {t('subscriber_pages.comments.add_comment')}
          </Text>
          <TextArea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t('subscriber_pages.comments.comment_placeholder')}
            rows={3}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim()}
          >
            {t('subscriber_pages.comments.submit')}
          </Button>
        </Card>
      )}

      {/* Comments List */}
      {comments.length === 0 ? (
        <Box style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
          <Text color="gray">{t('subscriber_pages.comments.no_comments')}</Text>
        </Box>
      ) : (
        <Box>
          {comments.map(comment => renderComment(comment))}
        </Box>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={showDeleteDialog !== null} onOpenChange={() => setShowDeleteDialog(null)}>
        <Dialog.Portal>
          <Dialog.Overlay 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000
            }}
          />
          <Dialog.Content 
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'white',
              padding: 'var(--space-4)',
              borderRadius: 'var(--radius-3)',
              boxShadow: 'var(--shadow-4)',
              zIndex: 1001,
              minWidth: '400px'
            }}
          >
            <Dialog.Title style={{ fontSize: 'var(--font-size-4)', fontWeight: 'var(--font-weight-6)', marginBottom: 'var(--space-3)' }}>
              {t('subscriber_pages.comments.delete_confirm_title')}
            </Dialog.Title>
            <Dialog.Description style={{ marginBottom: 'var(--space-4)', color: 'var(--gray-11)' }}>
              {t('subscriber_pages.comments.delete_confirm_message')}
            </Dialog.Description>
            <Flex gap="3" justify="end">
              <Button 
                variant="soft" 
                onClick={() => setShowDeleteDialog(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button 
                color="red" 
                onClick={() => showDeleteDialog && handleDeleteComment(showDeleteDialog)}
              >
                {t('common.delete')}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Box>
  );
};

export default BlogComments;
