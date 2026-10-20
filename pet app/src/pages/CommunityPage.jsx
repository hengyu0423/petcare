import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BracketTitle,
  CornerBrackets,
  Button,
  Tag
} from '@endfield-ui/react'
import {
  Dog,
  Cat,
  Bird,
  Rabbit,
  Fish,
  PawPrint,
  Heart,
  MessageSquare,
  Trash2,
  Plus,
  Image as ImageIcon,
  Send,
  X,
  Share2,
  Globe,
  User as UserIcon
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const SPECIES_ICONS = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  rabbit: Rabbit,
  fish: Fish,
  other: PawPrint
}

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
    <div className="mt-4 pt-3.5 border-t border-[#e5e5e5] space-y-3">
      {comments.length > 0 && (
        <div className="space-y-2.5">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2.5 group text-xs">
              <div className="w-6 h-6 border border-[#d9d9d9] bg-[#fafafa] flex items-center justify-center font-mono font-bold text-[#191919] shrink-0 text-[10px]">
                {c.user_name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 bg-[#fafafa] border border-[#e5e5e5] p-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-[#191919]">{c.user_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#8a8a8a]">{timeAgo(c.created_at)}</span>
                    {String(c.user_id) === String(currentUserId) && (
                      <button
                        onClick={() => deleteComment.mutate(c.id)}
                        className="text-[#b0b0b0] hover:text-[#dc2626] transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[#444] leading-relaxed">{c.content}</p>
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
              e.preventDefault()
              addComment.mutate(input.trim())
            }
          }}
          placeholder="撰寫留言..."
          className="flex-1 bg-[#f8f8f8] border border-[#d9d9d9] px-3 py-1.5 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden font-mono"
        />
        <Button
          type="button"
          variant="action"
          onClick={() => input.trim() && addComment.mutate(input.trim())}
          disabled={!input.trim() || addComment.isPending}
          className="text-xs py-1.5 px-3 font-mono"
        >
          送出
        </Button>
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
      setLikesCount(c => (liked ? c - 1 : c + 1))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })

  const SpeciesIcon = SPECIES_ICONS[post.pet_species] || PawPrint

  return (
    <div className="relative bg-white border border-[#d9d9d9] hover:border-[#191919] p-5 transition-colors shadow-2xs">
      <CornerBrackets size="sm" />

      {/* 用戶資訊 */}
      <div className="flex items-start justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border border-[#191919] bg-[#191919] text-[#fffa00] flex items-center justify-center text-xs font-mono font-bold shrink-0">
            {post.user_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#191919]">{post.user_name}</span>
              {post.pet_name && (
                <Tag size="sm" variant="default" className="text-[10px] font-mono flex items-center gap-1 bg-[#fafafa] border-[#e5e5e5]">
                  <SpeciesIcon size={11} />
                  <span>{post.pet_name}</span>
                </Tag>
              )}
            </div>
            <p className="text-[10px] font-mono text-[#8a8a8a] mt-0.5">
              {timeAgo(post.created_at)}
            </p>
          </div>
        </div>

        {String(post.user_id) === String(currentUser?.id) && (
          <button
            onClick={() => {
              if (window.confirm('確定要刪除這篇貼文嗎？')) onDelete(post.id)
            }}
            className="text-[#b0b0b0] hover:text-[#dc2626] transition-colors p-1"
            title="刪除貼文"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* 貼文內容 */}
      <p className="text-xs text-[#191919] leading-relaxed mb-3.5 whitespace-pre-wrap font-sans">
        {post.content}
      </p>

      {/* 貼文圖片 */}
      {post.image_url && (
        <div className="mb-3.5 border border-[#e5e5e5] bg-[#fafafa]">
          <img
            src={post.image_url}
            alt="貼文配圖"
            className="w-full max-h-96 object-contain mx-auto"
          />
        </div>
      )}

      {/* 互動條 */}
      <div className="flex items-center gap-4 pt-3 border-t border-[#e5e5e5] text-xs font-mono">
        <button
          onClick={() => likeMutation.mutate()}
          className={`flex items-center gap-1.5 transition-colors ${
            liked ? 'text-[#dc2626] font-bold' : 'text-[#8a8a8a] hover:text-[#191919]'
          }`}
        >
          <Heart size={14} className={liked ? 'fill-[#dc2626]' : ''} />
          <span>{likesCount > 0 ? likesCount : '0'} 讚</span>
        </button>

        <button
          onClick={() => setShowComments(s => !s)}
          className={`flex items-center gap-1.5 transition-colors ${
            showComments ? 'text-[#191919] font-bold' : 'text-[#8a8a8a] hover:text-[#191919]'
          }`}
        >
          <MessageSquare size={14} />
          <span>{Number(post.comments_count) > 0 ? post.comments_count : '0'} 留言</span>
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
      setContent('')
      setImageUrl('')
      setSelectedPetId('')
      setImagePreview('')
    }
  })

  const deletePost = useMutation({
    mutationFn: id => api.delete(`/posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['posts'] })
  })

  const handleImageChange = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setImagePreview(ev.target.result)
      setImageUrl(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = e => {
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
    setContent('')
    setImageUrl('')
    setSelectedPetId('')
    setImagePreview('')
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-6" data-theme="light">
      {/* 標題欄 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e5e5e5] pb-5">
        <div>
          <BracketTitle prefix="// SOCIAL.COMMUNITY">飼主社群</BracketTitle>
          <p className="text-xs font-mono text-[#8a8a8a] mt-1 tracking-wider">
            記錄與交流每位毛孩的日常生活與照護心得
          </p>
        </div>

        <Button
          variant="action"
          onClick={() => setShowPostModal(true)}
          className="text-xs py-2 px-3.5 flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>發表貼文</span>
        </Button>
      </div>

      {/* 快速發文導引框 */}
      <div
        className="relative bg-white border border-[#d9d9d9] hover:border-[#191919] p-4 cursor-pointer transition-colors shadow-2xs"
        onClick={() => setShowPostModal(true)}
      >
        <CornerBrackets size="sm" />
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-[#191919] bg-[#191919] text-[#fffa00] flex items-center justify-center text-xs font-mono font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 bg-[#f8f8f8] border border-[#e5e5e5] px-3 py-2 text-xs font-mono text-[#8a8a8a]">
            記錄今天與毛孩的有趣生活互動... // NEW_POST
          </div>
        </div>
      </div>

      {/* 貼文清單 */}
      {isLoading ? (
        <div className="border border-[#d9d9d9] bg-white p-12 text-center text-xs font-mono text-[#8a8a8a]">
          讀取社群貼文中... // LOADING_COMMUNITY
        </div>
      ) : posts.length === 0 ? (
        <div className="relative border border-[#d9d9d9] bg-white p-16 text-center">
          <CornerBrackets size="sm" />
          <Globe size={32} className="text-[#8a8a8a] mx-auto mb-2" />
          <p className="font-bold text-xs text-[#191919]">目前尚無社群貼文</p>
          <p className="text-[11px] font-mono text-[#8a8a8a] mt-1 mb-4">
            成為第一個分享毛孩生活點滴的飼主吧
          </p>
          <Button
            variant="action"
            onClick={() => setShowPostModal(true)}
            className="text-xs py-2 px-4"
          >
            發布第一篇貼文
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onDelete={id => deletePost.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* 發布貼文 Modal */}
      {showPostModal &&
        createPortal(
          <div className="fixed inset-0 bg-[#000000]/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" data-theme="light">
            <div className="relative bg-white border border-[#191919] shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <CornerBrackets size="md" />

              <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-4 bg-[#fffa00]" />
                  <span className="font-bold text-sm text-[#191919]">撰寫社群貼文</span>
                  <span className="text-[10px] font-mono text-[#8a8a8a]">// NEW_POST</span>
                </div>
                <button
                  onClick={closeModal}
                  className="w-7 h-7 flex items-center justify-center border border-[#e5e5e5] text-[#8a8a8a] hover:text-[#191919] hover:border-[#191919] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 貼文者資訊 */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 border border-[#191919] bg-[#191919] text-[#fffa00] flex items-center justify-center text-xs font-mono font-bold shrink-0">
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#191919]">{user?.name}</p>
                    {selectedPetId && (
                      <p className="text-[10px] font-mono text-[#8a8a8a]">
                        關聯毛孩：{pets.find(p => String(p.id) === selectedPetId)?.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* 貼文內容 */}
                <div>
                  <textarea
                    required
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="分享你和毛孩子的故事與心得..."
                    rows={4}
                    className="w-full bg-[#f8f8f8] border border-[#d9d9d9] p-3 text-xs text-[#191919] focus:border-[#191919] focus:outline-hidden transition-colors resize-none font-sans"
                  />
                </div>

                {/* 標記寵物 */}
                {pets.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
                      關聯寵物 / ASSOCIATED PET
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {pets.map(pet => {
                        const Icon = SPECIES_ICONS[pet.species] || PawPrint
                        const isSelected = String(selectedPetId) === String(pet.id)
                        return (
                          <button
                            key={pet.id}
                            type="button"
                            onClick={() =>
                              setSelectedPetId(s => (String(s) === String(pet.id) ? '' : String(pet.id)))
                            }
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border transition-colors ${
                              isSelected
                                ? 'bg-[#191919] text-[#fffa00] border-[#191919] font-bold'
                                : 'bg-[#fafafa] border-[#d9d9d9] text-[#555] hover:border-[#191919]'
                            }`}
                          >
                            <Icon size={12} />
                            <span>{pet.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 圖片上傳 */}
                <div>
                  <label className="block text-[11px] font-mono text-[#8a8a8a] mb-1.5 uppercase tracking-wider">
                    附加照片 / ATTACH PHOTO
                  </label>
                  <label className="flex items-center gap-2 px-3.5 py-2.5 border border-dashed border-[#d9d9d9] hover:border-[#191919] bg-[#fafafa] cursor-pointer transition-colors text-xs font-mono text-[#555]">
                    <ImageIcon size={15} />
                    <span>點擊選擇照片檔案</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                  {imagePreview && (
                    <div className="mt-2.5 relative border border-[#e5e5e5] bg-black">
                      <img
                        src={imagePreview}
                        alt="預覽"
                        className="w-full max-h-48 object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl('')
                          setImagePreview('')
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-black/70 text-white flex items-center justify-center border border-white/20 hover:bg-black"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-[#e5e5e5]">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={closeModal}
                    className="flex-1 py-2 text-xs border border-[#d9d9d9]"
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    variant="action"
                    disabled={!content.trim() || createPost.isPending}
                    className="flex-1 py-2 text-xs"
                  >
                    {createPost.isPending ? '發布中...' : '確認發布貼文'}
                  </Button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}