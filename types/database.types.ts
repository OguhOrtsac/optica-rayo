export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'dev' | 'owner' | 'seller' | 'customer'
          temporal_password_changed: boolean
          created_at: string
          bg_theme: 'dark' | 'light'
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role?: 'dev' | 'owner' | 'seller' | 'customer'
          temporal_password_changed?: boolean
          created_at?: string
          bg_theme?: 'dark' | 'light'
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'dev' | 'owner' | 'seller' | 'customer'
          temporal_password_changed?: boolean
          created_at?: string
          bg_theme?: 'dark' | 'light'
        }
      }
      customer_profiles: {
        Row: {
          id: string
          phone: string | null
          date_of_birth: string | null
          address: string | null
          occupation: string | null
          blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'NS' | null
          medical_notes: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          occupation?: string | null
          blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'NS' | null
          medical_notes?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          phone?: string | null
          date_of_birth?: string | null
          address?: string | null
          occupation?: string | null
          blood_type?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'NS' | null
          medical_notes?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          created_at?: string
        }
      }
      clinical_exams: {
        Row: {
          id: string
          customer_id: string
          examiner_id: string | null
          exam_date: string
          od_sphere: number | null
          od_cylinder: number | null
          od_axis: number | null
          od_add: number | null
          od_visual_acuity: string | null
          oi_sphere: number | null
          oi_cylinder: number | null
          oi_axis: number | null
          oi_add: number | null
          oi_visual_acuity: string | null
          pd_distance: number | null
          pd_near: number | null
          intraocular_pressure_od: number | null
          intraocular_pressure_oi: number | null
          lens_type: 'monofocal' | 'bifocal' | 'progresivo' | 'contacto' | 'ninguno' | null
          frame_recommendation: string | null
          treatment: string | null
          clinical_notes: string | null
          next_exam_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          examiner_id?: string | null
          exam_date?: string
          od_sphere?: number | null
          od_cylinder?: number | null
          od_axis?: number | null
          od_add?: number | null
          od_visual_acuity?: string | null
          oi_sphere?: number | null
          oi_cylinder?: number | null
          oi_axis?: number | null
          oi_add?: number | null
          oi_visual_acuity?: string | null
          pd_distance?: number | null
          pd_near?: number | null
          intraocular_pressure_od?: number | null
          intraocular_pressure_oi?: number | null
          lens_type?: 'monofocal' | 'bifocal' | 'progresivo' | 'contacto' | 'ninguno' | null
          frame_recommendation?: string | null
          treatment?: string | null
          clinical_notes?: string | null
          next_exam_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          examiner_id?: string | null
          exam_date?: string
          od_sphere?: number | null
          od_cylinder?: number | null
          od_axis?: number | null
          od_add?: number | null
          od_visual_acuity?: string | null
          oi_sphere?: number | null
          oi_cylinder?: number | null
          oi_axis?: number | null
          oi_add?: number | null
          oi_visual_acuity?: string | null
          pd_distance?: number | null
          pd_near?: number | null
          intraocular_pressure_od?: number | null
          intraocular_pressure_oi?: number | null
          lens_type?: 'monofocal' | 'bifocal' | 'progresivo' | 'contacto' | 'ninguno' | null
          frame_recommendation?: string | null
          treatment?: string | null
          clinical_notes?: string | null
          next_exam_date?: string | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          stock: number
          category: 'frames' | 'lenses' | 'contact_lenses' | 'accessories'
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          stock?: number
          category: 'frames' | 'lenses' | 'contact_lenses' | 'accessories'
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          stock?: number
          category?: 'frames' | 'lenses' | 'contact_lenses' | 'accessories'
          image_url?: string | null
          created_at?: string
        }
      }
      sales: {
        Row: {
          id: string
          customer_id: string | null
          seller_id: string | null
          exam_id: string | null
          coupon_id: string | null
          discount_applied: number
          total: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          seller_id?: string | null
          exam_id?: string | null
          coupon_id?: string | null
          discount_applied?: number
          total?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          seller_id?: string | null
          exam_id?: string | null
          coupon_id?: string | null
          discount_applied?: number
          total?: number
          notes?: string | null
          created_at?: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string | null
          quantity: number
          price: number
        }
        Insert: {
          id?: string
          sale_id: string
          product_id?: string | null
          quantity: number
          price: number
        }
        Update: {
          id?: string
          sale_id?: string
          product_id?: string | null
          quantity?: number
          price?: number
        }
      }
      coupons: {
        Row: {
          id: string
          code: string
          discount_percent: number
          valid_until: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          discount_percent: number
          valid_until: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          discount_percent?: number
          valid_until?: string
          is_active?: boolean
          created_at?: string
        }
      }
      reminders: {
        Row: {
          id: string
          customer_id: string
          last_visit_date: string
          next_suggested_visit: string
          status: 'pending' | 'sent' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          last_visit_date?: string
          next_suggested_visit: string
          status?: 'pending' | 'sent' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          last_visit_date?: string
          next_suggested_visit?: string
          status?: 'pending' | 'sent' | 'completed'
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
