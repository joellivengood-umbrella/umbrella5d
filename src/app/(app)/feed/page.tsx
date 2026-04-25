import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { BodyClass } from '@/components/app/BodyClass'

export const metadata: Metadata = {
  title: 'Organization Feed',
}

/**
 * Feed page — static prototype version.
 * Real multi-tenant post data (scoped to the user's org via RLS) comes
 * in a later phase; for now we render the same placeholder content
 * the prototype shipped with, plus the real compose-box avatar + org.
 */
export default async function FeedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Layout guarantees user, but narrow the type.
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, organization_name, avatar_url')
    .eq('id', user.id)
    .single()

  const orgName = profile?.organization_name || 'your organization'
  const avatarUrl = profile?.avatar_url || '/default_avatar.png'

  return (
    <>
      <BodyClass className="page-dashboard" />

      {/* Dark page header */}
      <div className="feed-header">
        <p className="section-eyebrow">{orgName}</p>
        <h1>Organization Feed</h1>
        <p className="feed-subtext">
          Stay up to date with your team&rsquo;s progress, questions, and news
          from the business world.
        </p>
      </div>

      {/* Feed content area */}
      <div className="feed-content">
        <div className="feed-layout">
          {/* Compose box */}
          <div className="feed-compose">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="feed-compose__avatar"
              src={avatarUrl}
              alt="Profile"
            />
            <input
              className="feed-compose__input"
              type="text"
              placeholder={`Share an update with ${orgName}…`}
              readOnly
            />
            <button className="feed-compose__btn" type="button">
              Post
            </button>
          </div>

          {/* POST 1 — U.S. Chamber of Commerce (featured) */}
          <article
            className="feed-post feed-post--featured"
            aria-label="Featured post from U.S. Chamber of Commerce"
          >
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--org"
                aria-hidden="true"
              >
                U.S.
                <br />
                Chamber
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">
                    U.S. Chamber of Commerce
                    <span className="feed-post__badge feed-post__badge--org">
                      Partner
                    </span>
                  </div>
                  <span className="feed-post__badge feed-post__badge--pinned">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="17" x2="12" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                    Pinned
                  </span>
                </div>
                <p className="feed-post__role">
                  Official Partner · Washington, D.C.
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                We&rsquo;re proud to partner with <strong>Umbrella5D</strong>{' '}
                in bringing world-class business education to our members. The
                Five Dimensions framework is already helping thousands of small
                business owners rethink how they deliver complete customer
                benefit.
              </p>
              <br />
              <p>
                Our latest report,{' '}
                <em>The 2026 Small Business Growth Outlook</em>, highlights how
                member companies using structured training programs like
                Umbrella5D are outpacing industry benchmarks in customer
                retention and revenue growth. We encourage every member
                organization to enroll their teams.
              </p>
              <br />
              <p>
                Read the full report →{' '}
                <a href="#">uschamber.com/2026-growth-outlook</a>
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#SmallBusiness</span>
              <span className="feed-post__tag">#2026GrowthOutlook</span>
              <span className="feed-post__tag">#CustomerBenefit</span>
            </div>

            <FeedPostActions likes={241} comments={38} />
          </article>

          {/* POST 2 — Marcus Webb */}
          <article className="feed-post" aria-label="Post from Marcus Webb">
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--a"
                aria-hidden="true"
              >
                MW
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">Marcus Webb</div>
                  <span className="feed-post__time">2h ago</span>
                </div>
                <p className="feed-post__role">
                  Business Development · Clearwater Solutions
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                Just finished{' '}
                <strong>Module 2: The Customer Paradigm</strong> last night and
                honestly — the section on how customer expectations have
                migrated over the last decade was a lightbulb moment. You start
                to realize how many assumptions we were making about what
                &ldquo;value&rdquo; even means to our clients.
              </p>
              <br />
              <p>
                Has anyone else been applying the complete customer benefit
                framework to their pitch decks? Curious if others are seeing
                the same reaction from prospects that I am. 👀
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#Module2</span>
              <span className="feed-post__tag">#CustomerParadigm</span>
            </div>

            <FeedPostActions likes={14} comments={5} />
          </article>

          {/* NEWS 1 */}
          <div className="feed-news" role="article" aria-label="News article">
            <div className="feed-news__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8" />
                <path d="M15 18h-5" />
                <path d="M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <div className="feed-news__content">
              <p className="feed-news__label">Umbrella5D Blog</p>
              <p className="feed-news__title">
                Small Business Owners Report 28% Increase in Customer Retention
                After Completing the Five Dimensions Program
              </p>
              <p className="feed-news__excerpt">
                A new survey of program graduates shows that businesses
                applying all five customer benefit dimensions see measurable
                improvements within 90 days of completion — with retention
                leading the way.
              </p>
              <div className="feed-news__footer">
                <span className="feed-news__source">umbrella5d.com</span>
                <span>·</span>
                <span>3h ago</span>
                <a href="#" className="feed-news__read-more">
                  Read more →
                </a>
              </div>
            </div>
          </div>

          {/* POST 3 — Sarah Kim */}
          <article className="feed-post" aria-label="Post from Sarah Kim">
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--b"
                aria-hidden="true"
              >
                SK
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">Sarah Kim</div>
                  <span className="feed-post__time">4h ago</span>
                </div>
                <p className="feed-post__role">
                  Operations Manager · Clearwater Solutions
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                Quick question for the group — has anyone started{' '}
                <strong>Module 3: The Umbrella Machine</strong> yet?
                I&rsquo;m trying to figure out the best way to schedule it for
                our team. Are you all going through the 32-step process solo
                first and then meeting to debrief? Or are some of you
                watching/working through it together in real time?
              </p>
              <br />
              <p>
                Also curious if the process works differently for service
                businesses vs. product companies. We&rsquo;re primarily
                services so would love to hear from others in a similar boat.
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#Module3</span>
              <span className="feed-post__tag">#UmbrellaMachine</span>
              <span className="feed-post__tag">#TeamLearning</span>
            </div>

            <FeedPostActions likes={9} comments={7} />
          </article>

          {/* POST 4 — Linda Torres */}
          <article className="feed-post" aria-label="Post from Linda Torres">
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--c"
                aria-hidden="true"
              >
                LT
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">Linda Torres</div>
                  <span className="feed-post__time">1d ago</span>
                </div>
                <p className="feed-post__role">
                  Sales Director · Clearwater Solutions
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                Team Clearwater just wrapped our kickoff session on{' '}
                <strong>Module 1: The Five Dimensions</strong>! I&rsquo;ll be
                honest — I wasn&rsquo;t sure how much a framework would change
                the way we think about our customer relationships, but this
                one landed differently.
              </p>
              <br />
              <p>
                The framing around what &ldquo;complete benefit&rdquo;
                actually means vs. what we assume it means has already shifted
                how I&rsquo;m prepping for our Q2 client reviews. Special
                shoutout to Marcus for pulling everyone together and keeping us
                accountable 💪
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#Module1</span>
              <span className="feed-post__tag">#FiveDimensions</span>
            </div>

            <FeedPostActions likes={22} comments={4} />
          </article>

          {/* NEWS 2 */}
          <div className="feed-news" role="article" aria-label="News article">
            <div className="feed-news__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
                <path d="M7 8h10" />
                <path d="M7 12h6" />
              </svg>
            </div>
            <div className="feed-news__content">
              <p className="feed-news__label">U.S. Chamber of Commerce</p>
              <p className="feed-news__title">
                Chamber Foundation Launches 2026 Small Business Support
                Initiative, Expanding Training Access Nationwide
              </p>
              <p className="feed-news__excerpt">
                The U.S. Chamber Foundation announced a new initiative to
                connect small businesses with structured education programs,
                citing the growing link between formal training and resilient
                revenue growth.
              </p>
              <div className="feed-news__footer">
                <span className="feed-news__source">uschamber.com</span>
                <span>·</span>
                <span>1d ago</span>
                <a href="#" className="feed-news__read-more">
                  Read more →
                </a>
              </div>
            </div>
          </div>

          {/* POST 5 — James Okafor (with reply) */}
          <article className="feed-post" aria-label="Post from James Okafor">
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--d"
                aria-hidden="true"
              >
                JO
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">James Okafor</div>
                  <span className="feed-post__time">1d ago</span>
                </div>
                <p className="feed-post__role">
                  Account Executive · Clearwater Solutions
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                Module 4 check-in: I&rsquo;ve been working through{' '}
                <strong>Implementation in Practice</strong> this week and it is
                dense — but incredibly actionable once you get into the rhythm
                of it. The prerequisite and objective structure really forces
                you to think before you execute, which I appreciate.
              </p>
              <br />
              <p>
                Anyone want to set up an informal study group to work through
                Module 4 together? Thinking a short weekly sync to share where
                we&rsquo;re at and what&rsquo;s clicking (or not). Drop a
                comment if you&rsquo;re interested 👇
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#Module4</span>
              <span className="feed-post__tag">#Implementation</span>
              <span className="feed-post__tag">#StudyGroup</span>
            </div>

            {/* Reply from Rachel */}
            <div className="feed-post__reply">
              <div
                className="feed-post__reply-avatar feed-post__avatar--e"
                aria-hidden="true"
              >
                RN
              </div>
              <div className="feed-post__reply-body">
                <p className="feed-post__reply-author">
                  Rachel Nguyen{' '}
                  <span
                    style={{ fontWeight: 400, color: 'var(--clr-muted)' }}
                  >
                    · Marketing Lead
                  </span>
                </p>
                <p className="feed-post__reply-text">
                  @James Okafor — Count me in! I&rsquo;m wrapping up Module 3
                  right now but would love to sync up when I hit Module 4. The
                  study group idea is great — especially for working through
                  the 32 steps without getting stuck.
                </p>
                <p className="feed-post__reply-time">23h ago</p>
              </div>
            </div>

            <FeedPostActions likes={17} comments={11} />
          </article>

          {/* NEWS 3 */}
          <div className="feed-news" role="article" aria-label="News article">
            <div className="feed-news__icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div className="feed-news__content">
              <p className="feed-news__label">Business Insider</p>
              <p className="feed-news__title">
                Why the &ldquo;Complete Customer Benefit&rdquo; Model Is
                Replacing Traditional Sales Funnels in 2026
              </p>
              <p className="feed-news__excerpt">
                Forward-thinking companies are moving beyond conversion metrics
                and toward holistic benefit delivery — and the data shows
                it&rsquo;s paying off. Companies aligning all five customer
                dimensions report 34% higher retention and 21% faster deal
                cycles.
              </p>
              <div className="feed-news__footer">
                <span className="feed-news__source">businessinsider.com</span>
                <span>·</span>
                <span>2d ago</span>
                <a href="#" className="feed-news__read-more">
                  Read more →
                </a>
              </div>
            </div>
          </div>

          {/* POST 6 — Rachel Nguyen */}
          <article className="feed-post" aria-label="Post from Rachel Nguyen">
            <div className="feed-post__header">
              <div
                className="feed-post__avatar feed-post__avatar--e"
                aria-hidden="true"
              >
                RN
              </div>
              <div className="feed-post__meta">
                <div className="feed-post__top-row">
                  <div className="feed-post__author">Rachel Nguyen</div>
                  <span className="feed-post__time">2d ago</span>
                </div>
                <p className="feed-post__role">
                  Marketing Lead · Clearwater Solutions
                </p>
              </div>
            </div>

            <div className="feed-post__body">
              <p>
                Something that came up in our marketing team discussion this
                week: we&rsquo;ve been using the Five Dimensions lens to audit
                our own content — asking whether each piece of content we
                produce addresses a genuine dimension of customer benefit, or
                whether it&rsquo;s just noise.
              </p>
              <br />
              <p>
                The results were humbling. We&rsquo;re going through a full
                content review as a result. Highly recommend running the same
                exercise if you&rsquo;re in marketing or communications —
                it&rsquo;s a different kind of gut check than most frameworks
                give you.
              </p>
            </div>

            <div className="feed-post__tags">
              <span className="feed-post__tag">#Marketing</span>
              <span className="feed-post__tag">#FiveDimensions</span>
              <span className="feed-post__tag">#ContentStrategy</span>
            </div>

            <FeedPostActions likes={31} comments={8} />
          </article>
        </div>
      </div>
    </>
  )
}

/**
 * Feed post action row (likes / comments / share).
 * Extracted to avoid repeating the SVG markup across every post.
 */
function FeedPostActions({
  likes,
  comments,
}: {
  likes: number
  comments: number
}) {
  return (
    <div className="feed-post__actions">
      <button className="feed-post__action-btn" type="button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
        <span>
          {likes} Like{likes === 1 ? '' : 's'}
        </span>
      </button>
      <button className="feed-post__action-btn" type="button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>
          {comments} Comment{comments === 1 ? '' : 's'}
        </span>
      </button>
      <button className="feed-post__action-btn" type="button">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>Share</span>
      </button>
    </div>
  )
}
