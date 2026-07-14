export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          badge_color: string | null
          category: string | null
          created_at: string
          description: string
          display_order: number | null
          icon: string
          id: string
          is_active: boolean | null
          name: string
          points: number | null
          requirements: Json
        }
        Insert: {
          badge_color?: string | null
          category?: string | null
          created_at?: string
          description: string
          display_order?: number | null
          icon: string
          id: string
          is_active?: boolean | null
          name: string
          points?: number | null
          requirements?: Json
        }
        Update: {
          badge_color?: string | null
          category?: string | null
          created_at?: string
          description?: string
          display_order?: number | null
          icon?: string
          id?: string
          is_active?: boolean | null
          name?: string
          points?: number | null
          requirements?: Json
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean | null
          is_dismissible: boolean | null
          message: string
          priority: number | null
          starts_at: string | null
          target_audience: string | null
          title: string | null
          type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dismissible?: boolean | null
          message: string
          priority?: number | null
          starts_at?: string | null
          target_audience?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean | null
          is_dismissible?: boolean | null
          message?: string
          priority?: number | null
          starts_at?: string | null
          target_audience?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      blog_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_post_categories: {
        Row: {
          category_id: string
          post_id: string
        }
        Insert: {
          category_id: string
          post_id: string
        }
        Update: {
          category_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_categories_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          excerpt: string | null
          featured_image: string | null
          id: string
          published_at: string | null
          reading_time: number | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          slug: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image?: string | null
          id?: string
          published_at?: string | null
          reading_time?: number | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: []
      }
      connection_pool_metrics: {
        Row: {
          active_connections: number | null
          created_at: string
          id: string
          idle_connections: number | null
          measurement_time: string
          total_connections: number | null
        }
        Insert: {
          active_connections?: number | null
          created_at?: string
          id?: string
          idle_connections?: number | null
          measurement_time?: string
          total_connections?: number | null
        }
        Update: {
          active_connections?: number | null
          created_at?: string
          id?: string
          idle_connections?: number | null
          measurement_time?: string
          total_connections?: number | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          category: string | null
          created_at: string
          email: string
          file_url: string | null
          id: string
          ip_address: unknown
          message: string
          name: string
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string | null
          subject: string
          ticket_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          email: string
          file_url?: string | null
          id?: string
          ip_address?: unknown
          message: string
          name: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string | null
          subject: string
          ticket_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          email?: string
          file_url?: string | null
          id?: string
          ip_address?: unknown
          message?: string
          name?: string
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string | null
          subject?: string
          ticket_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      directory_listings: {
        Row: {
          amount_paid: number
          category: string
          clicks_count: number | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          featured_until: string | null
          github_url: string | null
          id: string
          is_featured: boolean | null
          linkedin_url: string | null
          listing_tier: string
          logo_url: string | null
          name: string
          payment_order_id: string | null
          status: string
          tagline: string
          tags: string[] | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          views_count: number | null
          website_url: string | null
        }
        Insert: {
          amount_paid?: number
          category?: string
          clicks_count?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          featured_until?: string | null
          github_url?: string | null
          id?: string
          is_featured?: boolean | null
          linkedin_url?: string | null
          listing_tier?: string
          logo_url?: string | null
          name: string
          payment_order_id?: string | null
          status?: string
          tagline: string
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          views_count?: number | null
          website_url?: string | null
        }
        Update: {
          amount_paid?: number
          category?: string
          clicks_count?: number | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          featured_until?: string | null
          github_url?: string | null
          id?: string
          is_featured?: boolean | null
          linkedin_url?: string | null
          listing_tier?: string
          logo_url?: string | null
          name?: string
          payment_order_id?: string | null
          status?: string
          tagline?: string
          tags?: string[] | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number | null
          website_url?: string | null
        }
        Relationships: []
      }
      event_log: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          event_category: string | null
          event_type: string
          id: string
          ip_address: unknown
          metadata: Json | null
          referrer: string | null
          session_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category?: string | null
          event_type: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          referrer?: string | null
          session_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      idempotency_log: {
        Row: {
          created_at: string | null
          expires_at: string | null
          key: string
          response: Json
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          key: string
          response: Json
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          key?: string
          response?: Json
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          asking_price: number
          created_at: string
          featured: boolean | null
          from_block_id: string | null
          id: string
          original_price: number | null
          pixel_id: string
          seller_id: string
          sold_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          asking_price: number
          created_at?: string
          featured?: boolean | null
          from_block_id?: string | null
          id?: string
          original_price?: number | null
          pixel_id: string
          seller_id: string
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          asking_price?: number
          created_at?: string
          featured?: boolean | null
          from_block_id?: string | null
          id?: string
          original_price?: number | null
          pixel_id?: string
          seller_id?: string
          sold_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_from_block_id_fkey"
            columns: ["from_block_id"]
            isOneToOne: false
            referencedRelation: "pixel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: true
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      marketplace_transactions: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          pixel_id: string
          platform_fee: number | null
          refund_amount: number | null
          refund_reason: string | null
          refunded_at: string | null
          refunded_by: string | null
          sale_price: number
          seller_id: string
          seller_net: number
          status: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pixel_id: string
          platform_fee?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          sale_price: number
          seller_id: string
          seller_net: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          pixel_id?: string
          platform_fee?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_by?: string | null
          sale_price?: number
          seller_id?: string
          seller_net?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_transactions_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_queue: {
        Row: {
          action_taken: string | null
          content_id: string
          content_type: string
          created_at: string
          id: string
          owner_id: string | null
          priority: number | null
          report_details: string | null
          report_reason: string
          reported_by: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          owner_id?: string | null
          priority?: number | null
          report_details?: string | null
          report_reason: string
          reported_by?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          owner_id?: string | null
          priority?: number | null
          report_details?: string | null
          report_reason?: string
          reported_by?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mystery_pixels: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          expires_at: string
          id: string
          mystery_price: number
          original_price: number
          status: string
          x: number
          y: number
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          mystery_price?: number
          original_price: number
          status?: string
          x: number
          y: number
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          mystery_price?: number
          original_price?: number
          status?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      orphaned_orders: {
        Row: {
          amount: number
          attempted_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          notes: string | null
          razorpay_order_id: string
          refund_id: string | null
          resolved_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          attempted_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          notes?: string | null
          razorpay_order_id: string
          refund_id?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          attempted_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          notes?: string | null
          razorpay_order_id?: string
          refund_id?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_audit_log: {
        Row: {
          action: string
          change_reason: string | null
          changed_by: string
          created_at: string
          id: string
          new_status: string | null
          old_status: string | null
          payment_order_id: string
        }
        Insert: {
          action: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          payment_order_id: string
        }
        Update: {
          action?: string
          change_reason?: string | null
          changed_by?: string
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          payment_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_log_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          idempotency_key: string | null
          paid_at: string | null
          purchase_metadata: Json
          purchase_type: string
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_processed_at: string | null
          webhook_received_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          purchase_metadata?: Json
          purchase_type: string
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_processed_at?: string | null
          webhook_received_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          paid_at?: string | null
          purchase_metadata?: Json
          purchase_type?: string
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_processed_at?: string | null
          webhook_received_at?: string | null
        }
        Relationships: []
      }
      pixel_blocks: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          link_url: string | null
          max_x: number
          max_y: number
          min_x: number
          min_y: number
          owner_id: string
          payment_order_id: string | null
          pixel_count: number
          purchased_at: string
          total_price: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          link_url?: string | null
          max_x: number
          max_y: number
          min_x: number
          min_y: number
          owner_id: string
          payment_order_id?: string | null
          pixel_count: number
          purchased_at?: string
          total_price: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          link_url?: string | null
          max_x?: number
          max_y?: number
          min_x?: number
          min_y?: number
          owner_id?: string
          payment_order_id?: string | null
          pixel_count?: number
          purchased_at?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pixel_blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pixel_blocks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pixel_blocks_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_boosts: {
        Row: {
          amount_paid: number
          block_id: string | null
          boost_type: string
          created_at: string
          ends_at: string
          id: string
          pixel_id: string | null
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          block_id?: string | null
          boost_type?: string
          created_at?: string
          ends_at: string
          id?: string
          pixel_id?: string | null
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          block_id?: string | null
          boost_type?: string
          created_at?: string
          ends_at?: string
          id?: string
          pixel_id?: string | null
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pixel_boosts_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "pixel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pixel_boosts_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_clicks: {
        Row: {
          block_id: string | null
          clicked_at: string
          id: string
          pixel_id: string | null
          referrer: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          block_id?: string | null
          clicked_at?: string
          id?: string
          pixel_id?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          block_id?: string | null
          clicked_at?: string
          id?: string
          pixel_id?: string | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pixel_clicks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "pixel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pixel_clicks_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_history: {
        Row: {
          action: string
          block_id: string | null
          changed_by: string | null
          created_at: string
          from_owner_id: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          pixel_id: string
          price: number | null
          to_owner_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          block_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_owner_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          pixel_id: string
          price?: number | null
          to_owner_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          block_id?: string | null
          changed_by?: string | null
          created_at?: string
          from_owner_id?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          pixel_id?: string
          price?: number | null
          to_owner_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pixel_history_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "pixels"
            referencedColumns: ["id"]
          },
        ]
      }
      pixels: {
        Row: {
          alt_text: string | null
          block_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean | null
          last_sale_date: string | null
          last_sale_price: number | null
          link_url: string | null
          owner_id: string | null
          payment_order_id: string | null
          price_paid: number | null
          purchased_at: string | null
          times_resold: number | null
          updated_at: string
          view_count: number | null
          x: number
          y: number
        }
        Insert: {
          alt_text?: string | null
          block_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          link_url?: string | null
          owner_id?: string | null
          payment_order_id?: string | null
          price_paid?: number | null
          purchased_at?: string | null
          times_resold?: number | null
          updated_at?: string
          view_count?: number | null
          x: number
          y: number
        }
        Update: {
          alt_text?: string | null
          block_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_sale_date?: string | null
          last_sale_price?: number | null
          link_url?: string | null
          owner_id?: string | null
          payment_order_id?: string | null
          price_paid?: number | null
          purchased_at?: string | null
          times_resold?: number | null
          updated_at?: string
          view_count?: number | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "pixels_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "pixel_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pixels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "mv_leaderboard"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pixels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "pixels_payment_order_id_fkey"
            columns: ["payment_order_id"]
            isOneToOne: false
            referencedRelation: "payment_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          is_blocked: boolean | null
          last_active_at: string | null
          phone_number: string | null
          pixel_count: number | null
          referral_code: string | null
          referral_credits: number | null
          referred_by: string | null
          total_spent: number | null
          updated_at: string
          user_id: string
          website_url: string | null
          welcome_email_sent: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_blocked?: boolean | null
          last_active_at?: string | null
          phone_number?: string | null
          pixel_count?: number | null
          referral_code?: string | null
          referral_credits?: number | null
          referred_by?: string | null
          total_spent?: number | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          welcome_email_sent?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_blocked?: boolean | null
          last_active_at?: string | null
          phone_number?: string | null
          pixel_count?: number | null
          referral_code?: string | null
          referral_credits?: number | null
          referred_by?: string | null
          total_spent?: number | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          welcome_email_sent?: boolean | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          request_count: number | null
          updated_at: string | null
          user_id: string
          window_end_at: string | null
          window_start_at: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          request_count?: number | null
          updated_at?: string | null
          user_id: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          request_count?: number | null
          updated_at?: string | null
          user_id?: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          status: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          status?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          status?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          earned_at: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          earned_at?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          earned_at?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          email_marketing: boolean | null
          email_on_outbid: boolean | null
          email_on_purchase: boolean | null
          email_on_sale: boolean | null
          push_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_marketing?: boolean | null
          email_on_outbid?: boolean | null
          email_on_purchase?: boolean | null
          email_on_sale?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_marketing?: boolean | null
          email_on_outbid?: boolean | null
          email_on_purchase?: boolean | null
          email_on_sale?: boolean | null
          push_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_status: {
        Row: {
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          created_at: string
          is_blocked: boolean | null
          last_warning_at: string | null
          notes: string | null
          updated_at: string
          user_id: string
          warning_count: number | null
        }
        Insert: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          is_blocked?: boolean | null
          last_warning_at?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          warning_count?: number | null
        }
        Update: {
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          is_blocked?: boolean | null
          last_warning_at?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          warning_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      mv_daily_revenue: {
        Row: {
          avg_amount: number | null
          date: string | null
          max_amount: number | null
          min_amount: number | null
          order_count: number | null
          purchase_type: string | null
          total_amount: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      mv_grid_stats: {
        Row: {
          available_pixels: number | null
          avg_price: number | null
          last_sale_at: string | null
          sold_pixels: number | null
          total_blocks: number | null
          total_pixels: number | null
          total_revenue: number | null
          unique_owners: number | null
        }
        Relationships: []
      }
      mv_leaderboard: {
        Row: {
          avatar_url: string | null
          block_count: number | null
          full_name: string | null
          pixel_count: number | null
          total_spent: number | null
          user_id: string | null
        }
        Relationships: []
      }
      vw_project_leaderboard: {
        Row: {
          project_name: string | null
          owner_id: string | null
          avatar_url: string | null
          pixel_count: number | null
          total_spent: number | null
        }
        Relationships: []
      }
      vw_payment_analytics: {
        Row: {
          avg_paid_amount: number | null
          failed_count: number | null
          hour: string | null
          paid_amount: number | null
          total_orders: number | null
          unique_users: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_block_user: {
        Args: { p_reason: string; p_user_id: string }
        Returns: Json
      }
      admin_bulk_reset_area: {
        Args: {
          p_max_x: number
          p_max_y: number
          p_min_x: number
          p_min_y: number
        }
        Returns: Json
      }
      admin_bulk_reset_pixels: { Args: { p_pixels: Json }; Returns: Json }
      admin_clear_all_content: { Args: never; Returns: Json }
      admin_get_all_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_blocked: boolean
          last_active_at: string
          pixel_count: number
          total_spent: number
          user_id: string
        }[]
      }
      admin_get_audit_logs: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          action: string
          admin_email: string
          admin_user_id: string
          created_at: string
          details: Json
          id: string
          target_id: string
          target_type: string
        }[]
      }
      admin_get_marketplace_analytics: {
        Args: { p_days?: number }
        Returns: Json
      }
      admin_get_refund_history: {
        Args: { p_days_back?: number; p_limit?: number; p_offset?: number }
        Returns: {
          amount: number
          id: string
          processed_at: string
          reason: string
          status: string
          type: string
          user_email: string
        }[]
      }
      admin_get_revenue_stats: { Args: { p_days?: number }; Returns: Json }
      admin_promote_user: {
        Args: { make_admin?: boolean; target_email: string }
        Returns: Json
      }
      admin_recalculate_profiles: { Args: never; Returns: Json }
      admin_refund_marketplace_transaction: {
        Args: { p_reason: string; p_transaction_id: string }
        Returns: Json
      }
      admin_refund_payment_order: {
        Args: { p_payment_order_id: string; p_reason: string }
        Returns: Json
      }
      admin_remove_pixel: {
        Args: { p_reason?: string; p_x: number; p_y: number }
        Returns: Json
      }
      admin_resolve_moderation: {
        Args: {
          p_action?: string
          p_notes?: string
          p_queue_id: string
          p_status: string
        }
        Returns: Json
      }
      admin_set_user_admin: {
        Args: { p_is_admin: boolean; p_user_id: string }
        Returns: Json
      }
      admin_unblock_user: { Args: { p_user_id: string }; Returns: Json }
      batch_create_payment_orders: {
        Args: { p_orders: Json }
        Returns: {
          order_id: string
          razorpay_order_id: string
          success: boolean
        }[]
      }
      calculate_pixel_price: {
        Args: { p_x: number; p_y: number }
        Returns: number
      }
      cancel_profile_deletion: { Args: never; Returns: Json }
      check_achievements: { Args: { p_user_id: string }; Returns: Json }
      check_and_record_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_requests?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
        }[]
      }
      cleanup_soft_deleted_profiles: { Args: never; Returns: Json }
      complete_marketplace_purchase: {
        Args: {
          p_payment_order_id: string
          p_razorpay_payment_id: string
          p_razorpay_signature: string
        }
        Returns: Json
      }
      complete_pixel_purchase:
        | {
            Args: {
              p_alt_text?: string
              p_image_url?: string
              p_link_url?: string
              p_payment_order_id: string
              p_razorpay_payment_id: string
              p_razorpay_signature: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_alt_text?: string
              p_idempotency_key?: string
              p_image_url?: string
              p_link_url?: string
              p_payment_order_id: string
              p_razorpay_payment_id: string
              p_razorpay_signature: string
            }
            Returns: Json
          }
      create_payment_order: {
        Args: {
          p_amount: number
          p_purchase_metadata: Json
          p_purchase_type: string
          p_razorpay_order_id: string
        }
        Returns: string
      }
      delete_own_account: { Args: never; Returns: Json }
      delete_user_completely: {
        Args: { target_user_id: string }
        Returns: Json
      }
      expire_old_listings: { Args: never; Returns: number }
      expire_old_payment_orders: { Args: never; Returns: undefined }
      generate_slug: { Args: { p_text: string }; Returns: string }
      get_active_mystery_pixel: { Args: never; Returns: Json }
      get_admin_dashboard_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          is_blocked: boolean
          last_active_at: string
          pixel_count: number
          total_spent: number
          user_id: string
        }[]
      }
      get_block_pixel_status: {
        Args: { p_block_id: string }
        Returns: {
          can_list: boolean
          is_listed: boolean
          listing_price: number
          owner_id: string
          pixel_id: string
          x: number
          y: number
        }[]
      }
      get_directory_listings: {
        Args: {
          category_filter?: string
          page_num?: number
          page_size?: number
          search_query?: string
        }
        Returns: Json
      }
      get_grid_stats: { Args: never; Returns: Json }
      get_heatmap_data: { Args: never; Returns: Json }
      get_leaderboard: { Args: { p_limit?: number }; Returns: Json }
      get_marketplace_stats: { Args: never; Returns: Json }
      get_or_create_referral_code: { Args: never; Returns: Json }
      get_payment_reconciliation_status: {
        Args: { p_days_back?: number }
        Returns: {
          amount: number
          created_at: string
          issue: string
          paid_at: string
          payment_id: string
          razorpay_order_id: string
          razorpay_payment_id: string
          status: string
          user_id: string
          webhook_received_at: string
        }[]
      }
      get_pixel_analytics: { Args: { target_user_id: string }; Returns: Json }
      get_pixel_info: { Args: { p_x: number; p_y: number }; Returns: Json }
      get_platform_stats: { Args: never; Returns: Json }
      get_user_badges: {
        Args: { target_user_id: string }
        Returns: {
          badge_id: string
          description: string
          earned: boolean
          earned_at: string
          icon: string
          name: string
        }[]
      }
      get_user_payment_orders: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_user_id: string
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          paid_at: string
          razorpay_order_id: string
          status: string
        }[]
      }
      get_user_stats: { Args: { p_user_id?: string }; Returns: Json }
      increment_listing_views: {
        Args: { listing_id: string }
        Returns: undefined
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      is_current_user_super_admin: { Args: never; Returns: boolean }
      is_super_admin: { Args: { p_email: string }; Returns: boolean }
      list_pixel_for_sale: {
        Args: { p_asking_price: number; p_pixel_id: string }
        Returns: Json
      }
      log_activity: {
        Args: {
          p_activity_type: string
          p_description?: string
          p_is_public?: boolean
          p_target_id?: string
          p_target_type?: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      log_admin_action: {
        Args: {
          p_action: string
          p_details?: Json
          p_target_id?: string
          p_target_type: string
        }
        Returns: string
      }
      log_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_target_id?: string
          p_target_type?: string
        }
        Returns: string
      }
      log_webhook_event: {
        Args: { p_description?: string; p_event_type: string; p_payload?: Json }
        Returns: string
      }
      mark_payment_failed: {
        Args: { p_payment_order_id: string }
        Returns: boolean
      }
      permanently_delete_user_profile: {
        Args: { p_user_id: string }
        Returns: Json
      }
      purchase_from_marketplace_verified: {
        Args: {
          p_marketplace_transaction_id: string
          p_razorpay_payment_id: string
          p_razorpay_signature: string
        }
        Returns: Json
      }
      purge_expired_idempotency: { Args: never; Returns: number }
      purge_old_resolved_orphaned_orders: {
        Args: { p_days?: number }
        Returns: number
      }
      refresh_materialized_views: { Args: never; Returns: undefined }
      refresh_revenue_materialized_view: {
        Args: never
        Returns: {
          message: string
        }[]
      }
      report_content: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_details?: string
          p_reason: string
        }
        Returns: string
      }
      request_profile_deletion: { Args: never; Returns: Json }
      safely_update_payment_status: {
        Args: {
          p_new_status: string
          p_order_id: string
          p_payment_id?: string
          p_signature?: string
        }
        Returns: {
          message: string
          success: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

