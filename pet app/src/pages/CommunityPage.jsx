import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import PetIcon from '../components/brand/PetIcon'

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const diff = Date.now() - date.getTime()

  if (isNaN(date.getTime())) return ''

  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
}

const ICON = {
  heart: <path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z" />,
  comment: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3-.6L4 20l1.6-5.2A7.5 7.5 0 1 1 20 11.5Z" />,
  trash: <><path d="M4.5 7h15" /><path d="M9 7V5h6v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /><path d="M10 10.5v5M14 10.5v5" /></>,
  pencil: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="M14.5 6.5l3 3" /></>,
  camera: <><path d="M4 8.5h3l1.5-2h7L17 8.5h3v10H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  paw: <><ellipse cx="7" cy="8" rx="2" ry="2.4" /><ellipse cx="12" cy="5.8" rx="2" ry="2.4" /><ellipse cx="17" cy="8" rx="2" ry="2.4" /><path d="M12 11c-3 0-5.5 2.2-5.5 4.8 0 1.7 1.4 2.9 3 2.9 1 0 1.6-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-1.2 3-2.9C17.5 13.2 15 11 12 11Z" /></>
}

function LineIcon({ name, size = 16, filled = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {ICON[name] || ICON.paw}
    </svg>
  )
}

const fieldCls =
  'w-full border border-sand rounded-xl px-3 py-2.5 text-sm bg-cream text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-pine-700/35 focus:border-pine-700/40 focus:bg-plate transition-all'
const labelCls = 'mb-1.5 block text-xs font-semibold text-ink-soft'
const solidBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-honey px-4 py-2.5 text-sm font-extrabold text-pine-900 shadow-press transition-all hover:bg-honey-hover active:translate-y-[3px] active:shadow-none disabled:opacity-50'

function Avatar({ name, size = 36 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-pine-50 font-bold text-pine-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name?.[0]?.toUpperCase()}
    </span>
  )
}

function CommentSection({ postId, currentUserId }) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => api.get(`/posts/${postId}/comments`).then(r => r.data.data)
  })

  const addComment = useMutation({
    mutationFn: content => api.post(`/posts/${postId}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
      setInput('')
    }
  })

  const deleteComment = useMutation({
    mutationFn: commentId => api.delete(`/posts/${postId}/comments/${commentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', postId] })
      qc.invalidateQueries({ queryKey: ['posts'] })
    }
  })

  return (
    <div className="mt-3 border-t border-hair pt-3">
      {comments.length > 0 && (
        <div className="mb-3 space-y-3">
          {comments.map(c => (
            <div key={c.id} className="group flex gap-2">
              <Avatar name={c.user_name} size={28} />
              <div className="min-w-0 flex-1">
                <div className="inline-block max-w-full rounded-2xl rounded-tl-md bg-cream px-3 py-2">
                  <span className="text-xs font-bold text-pine-900">{c.user_name}</span>
                  <p className="mt-0.5 text-xs text-ink">{c.content}</p>
                </div>
                <div className="mt-1 flex items-center gap-3 px-2">
                  <span className="text-xs text-ink-soft/80">{timeAgo(c.created_at)}</span>
                  {String(c.user_id) === String(currentUserId) && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      className="text-xs text-ink-soft/60 opacity-0 transition-opacity hover:text-clay group-hover:opacity-100"
                    >
                      刪除
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
              e.preventDefault(); addComment.mutate(input.trim())
            }
          }}
          placeholder="留言..."
          className={`${fieldCls} flex-1`}
        />
        <button
          onClick={() => input.trim() && addComment.mutate(input.trim())}
          disabled={!input.trim() || addComment.isPending}
          className="rounded-xl bg-pine-800 px-3.5 py-2 text-sm font-bold text-warm transition-colors hover:bg-pine-700 disabled:opacity-50"
        >
          送出
        </button>
      </div>
    </div>
  )
}

function PostCard({ post, currentUser, onDelete }) {
  const qc = useQueryClient()
  const [showComments, setShowComments] = useState(false)
  const [liked, setLiked] = useState(post.is_liked)
  const [likesCount, setLikesCount] = useState(Number(post.likes_count))
  const selectedPet = post.pet_name
    ? <PetIcon species={post.pet_species} size={16} className="h-4 w-4" />
    : null

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/like`),
    onMutate: () => {
      setLiked(l => !l)
      setLikesCount(c => liked ? c - 1 : c + 1)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })

  return (
    <article className="rounded-3xl border border-hair shadow-card bg-plate p-5 transition-colors hover:bg-plate">
      {/* 用戶資訊 */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.user_name} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-pine-900">{post.user_name}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-soft/80">{timeAgo(post.created_at)}</span>
              {post.pet_name && (
                <>
                  <span className="text-xs text-ink-soft/60">·</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-pine-700">
                    {selectedPet}
                    {post.pet_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {String(post.user_id) === String(currentUser?.id) && (
          <button
            onClick={() => { if (confirm('確定刪除這篇貼文？')) onDelete(post.id) }}
            aria-label="刪除貼文"
            className="rounded-lg p-1.5 text-ink-soft/60 transition-colors hover:bg-clay-50 hover:text-clay"
          >
            <LineIcon name="trash" size={16} />
          </button>
        )}
      </div>

      {/* 內容 */}
      <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{post.content}</p>

      {/* 圖片 */}
      {post.image_url && (
        <div className="mb-3 overflow-hidden rounded-2xl">
          <img src={post.image_url} alt="貼文圖片" className="max-h-80 w-full object-cover" />
        </div>
      )}

      {/* 互動按鈕 */}
      <div className="flex items-center gap-4 border-t border-hair pt-2">
        <button
          onClick={() => likeMutation.mutate()}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            liked ? 'text-honey-deep' : 'text-ink-soft hover:text-honey-deep'
          }`}
        >
          <LineIcon name="heart" size={18} filled={liked} />
          <span>{likesCount > 0 ? likesCount : ''} 按讚</span>
        </button>
        <button
          onClick={() => setShowComments(s => !s)}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            showComments ? 'text-pine-700' : 'text-ink-soft hover:text-pine-700'
          }`}
        >
          <LineIcon name="comment" size={18} />
          <span>{Number(post.comments_count) > 0 ? post.comments_count : ''} 留言</span>
        </button>
      </div>

      {/* 留言區 */}
      {showComments && <CommentSection postId={post.id} currentUserId={currentUser?.id} />}
    </article>
  )
}

export default function CommunityPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showPostModal, setShowPostModal] = useState(false)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [selectedPetId, setSelectedPetId] = useState('')
  const [imagePreview, setImagePreview] = useState('')

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api.get('/posts').then(r => r.data.data)
  })

  const { data: pets = [] } = useQuery({
    queryKey: ['pets'],
    queryFn: () => api.get('/pets').then(r => r.data.data)
  })

  const createPost = useMutation({
    mutationFn: payload => api.post('/posts', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      setShowPostModal(false)
      setContent(''); setImageUrl(''); setSelectedPetId(''); setImagePreview('')
    }
  })

  const deletePost = useMutation({
    mutationFn: id => api.delete(`/posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
      setImageUrl(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!content.trim()) return
    createPost.mutate({
      content: content.trim(),
      imageUrl: imageUrl || null,
      petId: selectedPetId || null
    })
  }

  const closeModal = () => {
    setShowPostModal(false)
    setContent(''); setImageUrl(''); setSelectedPetId(''); setImagePreview('')
  }

  const taggedPet = pets.find(p => String(p.id) === selectedPetId)

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        accent="社群"
        subtitle="分享你和毛孩子的日常"
        actions={
          <button onClick={() => setShowPostModal(true)} className={solidBtn}>
            <LineIcon name="pencil" size={15} />
            發貼文
          </button>
        }
      />

      {/* 快速發文框 */}
      <div
        className="mb-5 cursor-pointer rounded-2xl border border-hair bg-plate p-4 transition-colors hover:border-pine-700/30"
        onClick={() => setShowPostModal(true)}
      >
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} />
          <div className="flex-1 rounded-xl border border-sand bg-cream px-4 py-2.5 text-sm text-ink-soft/80">
            分享你和毛孩子的故事...
          </div>
        </div>
      </div>

      {/* 貼文列表 */}
      {isLoading ? (
        <div className="space-y-4">
          {[0, 1].map(i => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon="chat"
          title="還沒有貼文"
          desc="成為第一個分享的人！"
          action={{ label: '發第一篇貼文', onClick: () => setShowPostModal(true) }}
        />
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUser={user} onDelete={id => deletePost.mutate(id)} />
          ))}
        </div>
      )}

      {/* 發貼文 Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine-900/35 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-hair bg-plate p-6 shadow-[0_30px_60px_-30px_rgba(87,54,17,0.55)]">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-brand text-base font-extrabold text-pine-900">發布新貼文</h2>
              <button
                onClick={closeModal}
                aria-label="關閉"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-warm hover:text-pine-900"
              >
                <LineIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 用戶資訊 */}
              <div className="flex items-center gap-3">
                <Avatar name={user?.name} />
                <div>
                  <p className="text-sm font-bold text-pine-900">{user?.name}</p>
                  {taggedPet && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-pine-700">
                      <PetIcon species={taggedPet.species} breed={taggedPet.breed} size={16} className="h-4 w-4" />
                      {taggedPet.name}
                    </p>
                  )}
                </div>
              </div>

              {/* 內容 */}
              <textarea
                required
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="分享你和毛孩子的故事..."
                rows={4}
                className={`${fieldCls} resize-none`}
              />

              {/* 標記寵物 */}
              {pets.length > 0 && (
                <div>
                  <label className={labelCls}>標記寵物（選填）</label>
                  <div className="flex flex-wrap gap-2">
                    {pets.map(pet => (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => setSelectedPetId(s => String(s) === String(pet.id) ? '' : String(pet.id))}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          String(selectedPetId) === String(pet.id)
                            ? 'border-pine-700 bg-pine-800 text-warm'
                            : 'border-sand bg-cream text-ink-soft hover:border-pine-700/40'
                        }`}
                      >
                        <PetIcon species={pet.species} breed={pet.breed} size={16} className="h-4 w-4" />
                        {pet.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 圖片上傳 */}
              <div>
                <label className={labelCls}>新增圖片（選填）</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#e2d8c1] px-4 py-2.5 transition-colors hover:border-pine-700/40 hover:bg-cream">
                  <span className="text-pine-700"><LineIcon name="camera" size={18} /></span>
                  <span className="text-sm text-ink-soft">點擊上傳圖片</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                {imagePreview && (
                  <div className="relative mt-2">
                    <img src={imagePreview} alt="預覽" className="max-h-48 w-full rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImageUrl(''); setImagePreview('') }}
                      aria-label="移除圖片"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-pine-900/60 text-plate hover:bg-pine-900/80"
                    >
                      <LineIcon name="close" size={13} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-line bg-plate py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-warm"
                >
                  取消
                </button>
                <button type="submit" disabled={!content.trim() || createPost.isPending} className={`${solidBtn} flex-1`}>
                  {createPost.isPending ? '發布中…' : '發布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
