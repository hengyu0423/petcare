import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const EMOJI = { dog:'🐶', cat:'🐱', bird:'🐦', rabbit:'🐰', fish:'🐟', other:'🐾' }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-TW')
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
    <div className="mt-3 pt-3 border-t border-gray-100">
      {comments.length > 0 && (
        <div className="space-y-3 mb-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2 group">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-700 shrink-0 mt-0.5">
                {c.user_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 rounded-2xl px-3 py-2 inline-block max-w-full">
                  <span className="text-xs font-bold text-gray-800">{c.user_name}</span>
                  <p className="text-xs text-gray-600 mt-0.5">{c.content}</p>
                </div>
                <div className="flex items-center gap-3 mt-1 px-2">
                  <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                  {String(c.user_id) === String(currentUserId) && (
                    <button onClick={() => deleteComment.mutate(c.id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
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
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && input.trim()) { e.preventDefault(); addComment.mutate(input.trim()) } }}
          placeholder="留言..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all" />
        <button onClick={() => input.trim() && addComment.mutate(input.trim())}
          disabled={!input.trim() || addComment.isPending}
          className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors">
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

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/posts/${post.id}/like`),
    onMutate: () => {
      setLiked(l => !l)
      setLikesCount(c => liked ? c - 1 : c + 1)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-sm transition-all">
      {/* 用戶資訊 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
            {post.user_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{post.user_name}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">{timeAgo(post.created_at)}</span>
              {post.pet_name && (
                <>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-green-600 font-medium">
                    {EMOJI[post.pet_species] || '🐾'} {post.pet_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        {String(post.user_id) === String(currentUser?.id) && (
          <button onClick={() => { if (confirm('確定刪除這篇貼文？')) onDelete(post.id) }}
            className="text-gray-300 hover:text-red-400 transition-colors text-sm">🗑️</button>
        )}
      </div>

      {/* 內容 */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>

      {/* 圖片 */}
      {post.image_url && (
        <div className="mb-3 rounded-xl overflow-hidden">
          <img src={post.image_url} alt="貼文圖片"
            className="w-full max-h-80 object-cover" />
        </div>
      )}

      {/* 互動按鈕 */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
        <button onClick={() => likeMutation.mutate()}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            liked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          }`}>
          {liked ? '❤️' : '🤍'}
          <span>{likesCount > 0 ? likesCount : ''} 按讚</span>
        </button>
        <button onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            showComments ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
          }`}>
          💬
          <span>{Number(post.comments_count) > 0 ? post.comments_count : ''} 留言</span>
        </button>
      </div>

      {/* 留言區 */}
      {showComments && (
        <CommentSection postId={post.id} currentUserId={currentUser?.id} />
      )}
    </div>
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">社群</h1>
          <p className="text-sm text-gray-400 mt-0.5">分享你和毛孩子的日常</p>
        </div>
        <button onClick={() => setShowPostModal(true)}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm">
          ✏️ 發貼文
        </button>
      </div>

      {/* 快速發文框 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5 cursor-pointer hover:border-green-300 transition-colors"
        onClick={() => setShowPostModal(true)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-400 border border-gray-200">
            分享你和毛孩子的故事...
          </div>
        </div>
      </div>

      {/* 貼文列表 */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3 animate-pulse">🐾</p>
          <p className="text-sm">載入貼文中...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-5xl mb-3">🌐</p>
          <p className="text-gray-400 text-sm mb-4">還沒有貼文，成為第一個分享的人！</p>
          <button onClick={() => setShowPostModal(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
            發第一篇貼文
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard key={post.id} post={post} currentUser={user}
              onDelete={id => deletePost.mutate(id)} />
          ))}
        </div>
      )}

      {/* 發貼文 Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-800">發布新貼文</h2>
              <button onClick={closeModal}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 用戶資訊 */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700 shrink-0">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{user?.name}</p>
                  {selectedPetId && (
                    <p className="text-xs text-green-600">
                      {EMOJI[pets.find(p => String(p.id) === selectedPetId)?.species]}{' '}
                      {pets.find(p => String(p.id) === selectedPetId)?.name}
                    </p>
                  )}
                </div>
              </div>

              {/* 內容 */}
              <textarea required value={content} onChange={e => setContent(e.target.value)}
                placeholder="分享你和毛孩子的故事..."
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white transition-all resize-none" />

              {/* 標記寵物 */}
              {pets.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">標記寵物（選填）</label>
                  <div className="flex gap-2 flex-wrap">
                    {pets.map(pet => (
                      <button key={pet.id} type="button"
                        onClick={() => setSelectedPetId(s => String(s) === String(pet.id) ? '' : String(pet.id))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          String(selectedPetId) === String(pet.id)
                            ? 'bg-green-500 text-white border-green-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300'
                        }`}>
                        {EMOJI[pet.species] || '🐾'} {pet.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 圖片上傳 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">新增圖片（選填）</label>
                <label className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-green-400 hover:bg-green-50 transition-all">
                  <span className="text-lg">📷</span>
                  <span className="text-sm text-gray-500">點擊上傳圖片</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>
                {imagePreview && (
                  <div className="mt-2 relative">
                    <img src={imagePreview} alt="預覽" className="w-full max-h-48 object-cover rounded-xl" />
                    <button type="button" onClick={() => { setImageUrl(''); setImagePreview('') }}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/70">✕</button>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm text-gray-500 hover:bg-gray-50 font-medium transition-colors">取消</button>
                <button type="submit" disabled={!content.trim() || createPost.isPending}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm">
                  {createPost.isPending ? '發布中...' : '發布'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}