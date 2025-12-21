export type ISODateString = string;

export type Article = {
  _id: string;
  source: string;
  source_normalized: string;
  title: string;
  content: string;
  link: string;
  published: ISODateString;
  category: string;
  word_count: number;
  keywords: string[];
};

export type SentimentDoc = {
  _id: string;
  published: ISODateString;
  source_normalized: string;
  category: string;
  title: string;
  link: string;
  keywords: string[];
  positive_count: number;
  negative_count: number;
  sentiment_score: number;
  sentiment: string;
  created_at: ISODateString;
};

export type BreakingEvent = {
  _id: string;
  window_start: ISODateString;
  window_end: ISODateString;
  category: string;
  keyword: string;
  exact_count: number;
  approx_count: number;
  sample_titles: string[];
  sample_links: string[];
  status: string;
  detected_at: ISODateString;
};

// ✅ القديم (بنخليه زي ما هو)
export type CategoryTrend = {
  _id: string;
  window_start: ISODateString;
  window_end: ISODateString;
  category: string;
  category_count: number;
  activity_level: string;
  created_at: ISODateString;
};

// ✅ جديد: Window type مرن بدل any
export type TrendWindow = {
  start?: ISODateString | string | number;
  end?: ISODateString | string | number;

  // دعم أسماء بديلة محتملة
  from?: ISODateString | string | number;
  to?: ISODateString | string | number;

  start_time?: ISODateString | string | number;
  end_time?: ISODateString | string | number;

  start_at?: ISODateString | string | number;
  end_at?: ISODateString | string | number;

  startAt?: ISODateString | string | number;
  endAt?: ISODateString | string | number;

  [key: string]: any;
};

// ✅ الجديد (Trending keywords)
export type TrendingKeyword = {
  _id: string;
  window?: TrendWindow;

  category: string;
  keyword: string;

  current_count: number; // Now
  previous_count: number; // Before

  trend_score: number;
  trend_level: string;

  created_at: ISODateString;

  // ✅ اختياري: إذا API رجّع نص جاهز للعرض
  time_window_text?: string;
};

export type PagedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};