export type MilestoneTrack = 'wellbeing' | 'career_israel' | 'germany_prep' | 'relationship' | 'contingency'
export type MilestoneStatus = 'not_started' | 'in_progress' | 'done'
export type VisitStatus = 'proposed' | 'confirmed'
export type NoteType = 'drawing' | 'note'
export type DiscussionStatus = 'open' | 'resolved'
export type IdeaCategory = 'activity' | 'question' | 'ritual'
export type QuoteCategory = 'love' | 'distance' | 'hope' | 'ours'
export type MomentSource = 'idea_bank' | 'freeform'

export interface Profile {
  id: string
  name: string
  avatar_color: string
}

export interface DailyQuote {
  id: string
  text: string
  author: string | null
  category: QuoteCategory
}

export interface WeeklyMoment {
  id: string
  week_start_date: string
  idea_text: string
  proposed_by: string
  source: MomentSource
  idea_bank_id: string | null
  date_time: string | null
  confirmed: boolean
  created_at: string
}

export interface IdeaBankItem {
  id: string
  idea_text: string
  category: IdeaCategory
  added_by: string
  created_at: string
}

export interface Visit {
  id: string
  status: VisitStatus
  traveler: string
  start_date: string
  end_date: string | null
  notes: string | null
  proposed_by: string
  created_at: string
}

export interface Milestone {
  id: string
  track: MilestoneTrack
  title: string
  definition_of_done: string
  target_date: string | null
  status: MilestoneStatus
  visibility: 'default' | 'tucked_away'
  created_at: string
  completed_at: string | null
}

export interface Achievement {
  id: string
  author: string
  text: string
  created_at: string
  partner_reacted: boolean
}

export interface CheckIn {
  id: string
  author: string
  date: string
  mood: number
  note: string | null
}

export interface Discussion {
  id: string
  title: string
  created_by: string
  status: DiscussionStatus
  entries: DiscussionEntry[]
  created_at: string
  resolved_at: string | null
}

export interface DiscussionEntry {
  id: string
  author: string
  text: string
  created_at: string
}

export interface NoteOrDoodle {
  id: string
  author: string
  type: NoteType
  content: string
  created_at: string
}
