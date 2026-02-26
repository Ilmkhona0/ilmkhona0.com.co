'use client'
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

export default function HomePage() {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hoveredApp, setHoveredApp] = useState<string|null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [replyTo, setReplyTo] = useState<string|null>(null);
  const [showReplies, setShowReplies] = useState<string|null>(null);
  const [liked, setLiked] = useState<{[key:string]: 'like'|'dislike'|null}>({});

  // Load like/dislike state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('commentVotes');
    if (stored) {
      setLiked(JSON.parse(stored));
    }
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const toggleMenu = () => {
    setSidebarOpen((prev) => !prev);
  };

  // Make fetchComments available everywhere
  const fetchComments = async () => {
    const res = await fetch('/api/comments');
    if (res.ok) {
      setComments(await res.json());
    }
  };

  const handleLikeDislike = async (commentId: string, action: 'like'|'dislike') => {
    // Only allow one like/dislike per comment
    if (liked[commentId] === action) return;
    const updated = { ...liked, [commentId]: action };
    setLiked(updated);
    localStorage.setItem('commentVotes', JSON.stringify(updated));
    await fetch('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentId, action })
    });
    fetchComments();
  };

  // Fetch comments and check admin on mount
  useEffect(() => {
    fetchComments();
    if (globalThis.window) {
      setIsAdmin(localStorage.getItem('isAdmin') === 'true');
    }
  }, []);

  const handleCommentSubmit = async (e: React.FormEvent<HTMLFormElement>, parentId?: string) => {
    e.preventDefault();
    const form = e.currentTarget;
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement)?.value;
    if (!message) return;
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parentId ? { message, parentId } : { message }),
    });
    if (res.ok) {
      form.reset();
      setReplyTo(null);
      fetchComments();
    }
  };

  return (
    <div>
      {/* HAMBURGER MENU BUTTON */}
      <div
        className="hamburger"
        onClick={toggleMenu}
        role="button"
        tabIndex={0}
        aria-label="Open menu"
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleMenu()}
        style={{cursor:'pointer'}}
      >
        <i className="fas fa-bars"></i>
      </div>

      {/* SIDEBAR MENU */}
      <nav id="sidebar" className={`sidebar${sidebarOpen ? ' open' : ''}`}> 
        <a href="/" aria-current="page"><i className="fas fa-home"></i> Home</a>
        <a href="#images"><i className="fas fa-image"></i> Images</a>
        <a href="#videos"><i className="fas fa-video"></i> Videos</a>
        <a href="#apps"><i className="fas fa-th"></i> Apps</a>
        <a href="#games"><i className="fas fa-gamepad"></i> Games</a>
        <a href="#contact"><i className="fas fa-phone"></i> Contact</a>
        {isAdmin ? <a href="/profile"><i className="fas fa-user"></i> Profile</a> : null}
      </nav>

      {/* HEADER */}
      <header>
        <div className="site-title">ilmkhona0</div>
        <nav style={{display:'flex',gap:24}}>
          <a href="/images">Images</a>
          <a href="/videos">Videos</a>
          <a href="/apps">Apps</a>
          <a href="/games">Games</a>
          <a href="#contact">Contact</a>
        </nav>
        <a href="/auth" className="login-register" style={{marginLeft:'auto'}}>
          <i className="fas fa-user-plus"></i> Login / Register
        </a>
      </header>

      {/* MAIN CONTENT */}
      <main className="container">
        {/* IMAGES SECTION (static demo) */}
        <section id="images" className="links-section" style={{overflowX:'auto',display:'flex',gap:24,paddingBottom:16}}>
          <h2>Images</h2>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{minWidth:140,display:'flex',flexDirection:'column',alignItems:'center'}}>
              <Image src={`/public/sample-image${i}.jpg`} alt={`Sample ${i}`} width={120} height={90} style={{borderRadius:8}} />
              <span style={{marginTop:8}}>Sample image {i} description.</span>
            </div>
          ))}
        </section>

        {/* VIDEOS SECTION */}
        {/* VIDEOS SECTION (static demo) */}
        <section id="videos" className="links-section" style={{overflowX:'auto',display:'flex',gap:24,paddingBottom:16}}>
          <h2>Videos</h2>
          {[1,2,3].map(i => (
            <div key={i} style={{minWidth:220,display:'flex',flexDirection:'column',alignItems:'center'}}>
              <video width="200" controls>
                <source src={`/public/sample-video${i}.mp4`} type="video/mp4" />
                <track kind="captions" />
                Your browser does not support the video tag.
              </video>
              <span style={{marginTop:8}}>Sample video {i} description.</span>
            </div>
          ))}
        </section>

        {/* APPS SECTION */}
        {/* APPS SECTION */}
        <section id="apps" className="links-section" style={{overflowX:'auto',display:'flex',gap:24,paddingBottom:16}}>
          <h2>Apps</h2>
          {["App1","App2","App3"].map(app => (
            <div
              key={app}
              onMouseEnter={()=>setHoveredApp(app)}
              onMouseLeave={()=>setHoveredApp(null)}
              style={{minWidth:140,padding:8,border:'1px solid #eee',borderRadius:8,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center'}}
              role="button"
              tabIndex={0}
              aria-label={app}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setHoveredApp(app)}
            >
              <i className="fas fa-mobile-alt"></i> {app}
              {hoveredApp===app && <div className="app-description">{app} description goes here.</div>}
            </div>
          ))}
        </section>


        {/* Games SECTION */}
        <section id="games" className="links-section" style={{overflowX:'auto',display:'flex',gap:24,paddingBottom:16}}>
          <h2>Games</h2>
          {["GuessingGame","SecretMessages"].map(game => (
            <div
              key={game}
              onMouseEnter={()=>setHoveredApp(game)}
              onMouseLeave={()=>setHoveredApp(null)}
              style={{minWidth:140,padding:8,border:'1px solid #eee',borderRadius:8,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center'}}
              role="button"
              tabIndex={0}
              aria-label={game}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setHoveredApp(game)}
            >
              <a
                href={game==="GuessingGame"?"/public/games/GuessingGame/src/GuessingGame.exe":"/public/games/Secret Messages/src/Secret Messages.exe"}
                download
              >
                <i className="fas fa-download"></i> {game}.exe
              </a>
              {hoveredApp===game && <div className="app-description">{game==="GuessingGame"?"Think you're good at guessing numbers? Challenge yourself with this exciting guessing game.":"Send secret messages securely with this app."}</div>}
            </div>
          ))}
        </section>

        {/* CONTACT SECTION */}
                {/* FILES SECTION (static demo) */}
                <section id="files" className="links-section" style={{overflowX:'auto',display:'flex',gap:24,paddingBottom:16}}>
                  <h2>Files</h2>
                  {["sample.pdf","sample.docx","sample.txt"].map(file => (
                    <div key={file} style={{minWidth:140,display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <a href={`/public/files/${file}`} download>
                        <i className="fas fa-file-alt"></i> {file}
                      </a>
                      <span style={{marginTop:8}}>Download {file}</span>
                    </div>
                  ))}
                </section>
        {/* CONTACT SECTION (static demo) */}
        <section id="contact" className="contacts-section">
          <h2>Contact Us</h2>
          <p><i className="fab fa-github"></i> GitHub: <a href="https://github.com/ilmkhona0" target="_blank">ilmkhona0</a></p>
          <p><i className="fas fa-envelope"></i> Email: <a href="mailto:ilmkhona@gmail.com">ilmkhona@gmail.com</a></p>
          <p><i className="fab fa-whatsapp"></i> WhatsApp: <a href="https://wa.me/+992550253311">ilmkhona0</a></p>
        </section>

        {/* COMMENTS SECTION TOGGLE ICON */}
        <div style={{ position: 'fixed', left: 32, bottom: 110, zIndex: 1200 }}>
          <button
            aria-label={showComments ? 'Hide comments' : 'Show comments'}
            style={{
              background: '#fff',
              border: 'none',
              borderRadius: '50%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              width: 56,
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 28,
              color: '#222',
              transition: 'background 0.2s',
            }}
            onClick={() => setShowComments((v) => !v)}
          >
            <i className="fas fa-comment"></i>
          </button>
        </div>
        {showComments && (
          <section className="comments-section" style={{ position: 'fixed', left: 32, bottom: 140, zIndex: 1200, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: 24, minWidth: 320, maxWidth: '90vw' }}>
            <h2>Leave a Comment</h2>
            <form id="commentForm" className="form-container" onSubmit={handleCommentSubmit}>
              <label htmlFor="comment-textarea">Your Comment</label>
              <textarea id="comment-textarea" name="message" rows={4} required></textarea>
              <button type="submit">Submit</button>
            </form>

            <div id="comments" className="comments-list">
              {comments.filter(c => !c.parentId).length === 0 && <p>No comments yet.</p>}
              {comments.filter(c => !c.parentId).map((c) => (
                <div key={c._id} style={{marginBottom:16, borderBottom:'1px solid #eee', paddingBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <strong>{c.message}</strong>
                    <span style={{fontSize:'0.8em',color:'#888'}}>{new Date(c.date).toLocaleString()}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:12,marginTop:4}}>
                    <button
                      type="button"
                      aria-label="Like"
                      style={{
                        background:'none',
                        border:'none',
                        cursor:'pointer',
                        color: liked[c._id]==='like' ? 'gold' : '#222',
                        opacity: liked[c._id]==='like' ? 1 : 0.7,
                        fontWeight: liked[c._id]==='like' ? 'bold' : 'normal',
                        fontSize: 18
                      }}
                      onClick={()=>handleLikeDislike(c._id,'like')}
                    >
                      <span style={{marginRight:4}}>👍</span> {c.likes || 0}
                    </button>
                    <button
                      type="button"
                      aria-label="Dislike"
                      style={{
                        background:'none',
                        border:'none',
                        cursor:'pointer',
                        color: liked[c._id]==='dislike' ? 'gold' : '#222',
                        opacity: liked[c._id]==='dislike' ? 1 : 0.7,
                        fontWeight: liked[c._id]==='dislike' ? 'bold' : 'normal',
                        fontSize: 18
                      }}
                      onClick={()=>handleLikeDislike(c._id,'dislike')}
                    >
                      <span style={{marginRight:4}}>👎</span> {c.dislikes || 0}
                    </button>
                    <button type="button" aria-label="Reply" style={{background:'none',border:'none',color:'#0070f3',cursor:'pointer'}} onClick={()=>setReplyTo(c._id)}>
                      Reply
                    </button>
                    {c.replyCount > 0 && (
                      <button type="button" aria-label="Show replies" style={{background:'none',border:'none',color:'#0070f3',cursor:'pointer'}} onClick={()=>setShowReplies(showReplies===c._id?null:c._id)}>
                        {showReplies===c._id ? 'Hide' : 'Show'} {c.replyCount} {c.replyCount === 1 ? 'reply' : 'replies'}
                      </button>
                    )}
                  </div>
                  {replyTo === c._id && (
                    <form className="form-container" style={{marginTop:8}} onSubmit={e=>handleCommentSubmit(e, c._id)}>
                      <label htmlFor={`reply-textarea-${c._id}`}>Your Reply</label>
                      <textarea id={`reply-textarea-${c._id}`} name="message" rows={2} required></textarea>
                      <button type="submit">Submit</button>
                      <button type="button" style={{marginLeft:8}} onClick={()=>setReplyTo(null)}>Cancel</button>
                    </form>
                  )}
                  {/* Replies */}
                  {showReplies===c._id && comments.filter(r=>r.parentId===c._id).length > 0 && (
                    <div style={{marginLeft:24,marginTop:8,background:'#fafafa',borderRadius:8,padding:8}}>
                      {comments.filter(r=>r.parentId===c._id).map(r=>(
                        <div key={r._id} style={{marginBottom:8}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <strong>{r.message}</strong>
                            <span style={{fontSize:'0.8em',color:'#888'}}>{new Date(r.date).toLocaleString()}</span>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:12,marginTop:2}}>
                            <button
                              type="button"
                              aria-label="Like"
                              style={{
                                background:'none',
                                border:'none',
                                cursor:'pointer',
                                color: liked[r._id]==='like' ? 'gold' : '#222',
                                opacity: liked[r._id]==='like' ? 1 : 0.7,
                                fontWeight: liked[r._id]==='like' ? 'bold' : 'normal',
                                fontSize: 18
                              }}
                              onClick={()=>handleLikeDislike(r._id,'like')}
                            >
                              <span style={{marginRight:4}}>👍</span> {r.likes || 0}
                            </button>
                            <button
                              type="button"
                              aria-label="Dislike"
                              style={{
                                background:'none',
                                border:'none',
                                cursor:'pointer',
                                color: liked[r._id]==='dislike' ? 'gold' : '#222',
                                opacity: liked[r._id]==='dislike' ? 1 : 0.7,
                                fontWeight: liked[r._id]==='dislike' ? 'bold' : 'normal',
                                fontSize: 18
                              }}
                              onClick={()=>handleLikeDislike(r._id,'dislike')}
                            >
                              <span style={{marginRight:4}}>👎</span> {r.dislikes || 0}
                            </button>
                            <button type="button" aria-label="Reply" style={{background:'none',border:'none',color:'#0070f3',cursor:'pointer'}} onClick={()=>setReplyTo(r._id)}>
                              Reply
                            </button>
                          </div>
                          {replyTo === r._id && (
                            <form className="form-container" style={{marginTop:8}} onSubmit={e=>handleCommentSubmit(e, r._id)}>
                              <label htmlFor={`reply-textarea-${r._id}`}>Your Reply</label>
                              <textarea id={`reply-textarea-${r._id}`} name="message" rows={2} required></textarea>
                              <button type="submit">Submit</button>
                              <button type="button" style={{marginLeft:8}} onClick={()=>setReplyTo(null)}>Cancel</button>
                            </form>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      <footer style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#222', color: '#fff', textAlign: 'center', padding: '15px 0', zIndex: 1000 }}>
        <p>&copy; 2026 ilmkhona0. All rights reserved.</p>
      </footer>
    </div>
  );
}
