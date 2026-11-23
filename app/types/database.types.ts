
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "alert_delivery": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["alert_kind"],"operator_id": string,"result": string | null,"sent_at": string | null,"stop_sequence": number,"subscription_id": string,"trip_instance_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["alert_kind"],"operator_id": string,"result"?: string | null,"sent_at"?: string | null,"stop_sequence": number,"subscription_id": string,"trip_instance_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["alert_kind"],"operator_id"?: string,"result"?: string | null,"sent_at"?: string | null,"stop_sequence"?: number,"subscription_id"?: string,"trip_instance_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "alert_delivery_operator_id_trip_instance_id_fkey"
      columns: ["operator_id","trip_instance_id"]
isOneToOne: false
      referencedRelation: "trip_instance"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "alert_delivery_subscription_id_fkey"
      columns: ["subscription_id"]
isOneToOne: false
      referencedRelation: "subscription"
      referencedColumns: ["id"]
    }
                  ]
                },"audience": {
                  Row: {
                    "created_at": string,"id": string,"name": NonNullable<Json>,"operator_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": NonNullable<Json>,"operator_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: NonNullable<Json>,"operator_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audience_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"audience_route": {
                  Row: {
                    "audience_id": string,"can_see_map": boolean,"operator_id": string,"route_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_id": string,"can_see_map"?: boolean,"operator_id": string,"route_id": string
                  }
                  Update: {
                    "audience_id"?: string,"can_see_map"?: boolean,"operator_id"?: string,"route_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audience_route_operator_id_audience_id_fkey"
      columns: ["operator_id","audience_id"]
isOneToOne: false
      referencedRelation: "audience"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "audience_route_operator_id_route_id_fkey"
      columns: ["operator_id","route_id"]
isOneToOne: false
      referencedRelation: "route"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"boarding_event": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["boarding_event_kind"],"occurred_at": string,"operator_id": string,"source_event_id": string | null,"stop_sequence": number | null,"tag_id": string,"trip_instance_id": string | null,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["boarding_event_kind"],"occurred_at": string,"operator_id": string,"source_event_id"?: string | null,"stop_sequence"?: number | null,"tag_id": string,"trip_instance_id"?: string | null,"vehicle_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["boarding_event_kind"],"occurred_at"?: string,"operator_id"?: string,"source_event_id"?: string | null,"stop_sequence"?: number | null,"tag_id"?: string,"trip_instance_id"?: string | null,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "boarding_event_operator_id_tag_id_fkey"
      columns: ["operator_id","tag_id"]
isOneToOne: false
      referencedRelation: "tag"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "boarding_event_operator_id_trip_instance_id_fkey"
      columns: ["operator_id","trip_instance_id"]
isOneToOne: false
      referencedRelation: "trip_instance"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "boarding_event_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"calendar_exception": {
                  Row: {
                    "calendar_id": string,"created_at": string,"end_date": string,"id": string,"operator_id": string,"reason": string | null,"start_date": string,"type": Database["public"]['Enums']["calendar_exception_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "calendar_id": string,"created_at"?: string,"end_date": string,"id"?: string,"operator_id": string,"reason"?: string | null,"start_date": string,"type": Database["public"]['Enums']["calendar_exception_type"]
                  }
                  Update: {
                    "calendar_id"?: string,"created_at"?: string,"end_date"?: string,"id"?: string,"operator_id"?: string,"reason"?: string | null,"start_date"?: string,"type"?: Database["public"]['Enums']["calendar_exception_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_exception_operator_id_calendar_id_fkey"
      columns: ["operator_id","calendar_id"]
isOneToOne: false
      referencedRelation: "service_calendar"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"device": {
                  Row: {
                    "created_at": string,"id": string,"language": string | null,"last_seen_at": string,"platform": Database["public"]['Enums']["device_platform"] | null,"push_token": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"language"?: string | null,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"] | null,"push_token"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"language"?: string | null,"last_seen_at"?: string,"platform"?: Database["public"]['Enums']["device_platform"] | null,"push_token"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"invite_code": {
                  Row: {
                    "audience_id": string,"code_hash": string,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"label": string | null,"max_uses": number | null,"operator_id": string,"revoked_at": string | null,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_id": string,"code_hash": string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"label"?: string | null,"max_uses"?: number | null,"operator_id": string,"revoked_at"?: string | null,"uses"?: number
                  }
                  Update: {
                    "audience_id"?: string,"code_hash"?: string,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"label"?: string | null,"max_uses"?: number | null,"operator_id"?: string,"revoked_at"?: string | null,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_code_operator_id_audience_id_fkey"
      columns: ["operator_id","audience_id"]
isOneToOne: false
      referencedRelation: "audience"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"membership": {
                  Row: {
                    "audience_id": string,"device_id": string,"id": string,"invite_code_id": string | null,"joined_at": string,"operator_id": string,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_id": string,"device_id": string,"id"?: string,"invite_code_id"?: string | null,"joined_at"?: string,"operator_id": string,"revoked_at"?: string | null
                  }
                  Update: {
                    "audience_id"?: string,"device_id"?: string,"id"?: string,"invite_code_id"?: string | null,"joined_at"?: string,"operator_id"?: string,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "device"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_invite_code_id_fkey"
      columns: ["invite_code_id"]
isOneToOne: false
      referencedRelation: "invite_code"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "membership_operator_id_audience_id_fkey"
      columns: ["operator_id","audience_id"]
isOneToOne: false
      referencedRelation: "audience"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"operator": {
                  Row: {
                    "boarding_check_enabled": boolean,"branding": NonNullable<Json>,"created_at": string,"default_visibility": Database["public"]['Enums']["route_visibility"],"id": string,"languages": (string)[],"name": NonNullable<Json>,"plan": string,"slug": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "boarding_check_enabled"?: boolean,"branding"?: NonNullable<Json>,"created_at"?: string,"default_visibility"?: Database["public"]['Enums']["route_visibility"],"id"?: string,"languages"?: (string)[],"name": NonNullable<Json>,"plan"?: string,"slug": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "boarding_check_enabled"?: boolean,"branding"?: NonNullable<Json>,"created_at"?: string,"default_visibility"?: Database["public"]['Enums']["route_visibility"],"id"?: string,"languages"?: (string)[],"name"?: NonNullable<Json>,"plan"?: string,"slug"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"operator_link": {
                  Row: {
                    "created_at": string,"id": string,"label": NonNullable<Json>,"operator_id": string,"sort_order": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": NonNullable<Json>,"operator_id": string,"sort_order"?: number,"url": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: NonNullable<Json>,"operator_id"?: string,"sort_order"?: number,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operator_link_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"pattern_stop": {
                  Row: {
                    "arrival_offset": number,"departure_offset": number,"dist_along_shape": number | null,"operator_id": string,"pattern_id": string,"stop_id": string,"stop_sequence": number
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival_offset": number,"departure_offset": number,"dist_along_shape"?: number | null,"operator_id": string,"pattern_id": string,"stop_id": string,"stop_sequence": number
                  }
                  Update: {
                    "arrival_offset"?: number,"departure_offset"?: number,"dist_along_shape"?: number | null,"operator_id"?: string,"pattern_id"?: string,"stop_id"?: string,"stop_sequence"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pattern_stop_operator_id_pattern_id_fkey"
      columns: ["operator_id","pattern_id"]
isOneToOne: false
      referencedRelation: "trip_pattern"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "pattern_stop_operator_id_stop_id_fkey"
      columns: ["operator_id","stop_id"]
isOneToOne: false
      referencedRelation: "stop"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "pattern_stop_operator_id_stop_id_fkey"
      columns: ["operator_id","stop_id"]
isOneToOne: false
      referencedRelation: "stop_location"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"post": {
                  Row: {
                    "audience_id": string | null,"body": NonNullable<Json>,"created_at": string,"created_by": string | null,"expires_at": string | null,"id": string,"operator_id": string,"published_at": string | null,"route_id": string | null,"send_push": boolean,"title": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience_id"?: string | null,"body": NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"operator_id": string,"published_at"?: string | null,"route_id"?: string | null,"send_push"?: boolean,"title": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "audience_id"?: string | null,"body"?: NonNullable<Json>,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string | null,"id"?: string,"operator_id"?: string,"published_at"?: string | null,"route_id"?: string | null,"send_push"?: boolean,"title"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_operator_id_audience_id_fkey"
      columns: ["operator_id","audience_id"]
isOneToOne: false
      referencedRelation: "audience"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "post_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "post_operator_id_route_id_fkey"
      columns: ["operator_id","route_id"]
isOneToOne: false
      referencedRelation: "route"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"route": {
                  Row: {
                    "active": boolean,"color": string | null,"created_at": string,"gtfs_id": string | null,"id": string,"name": NonNullable<Json>,"operator_id": string,"short_name": string | null,"sort_order": number,"text_color": string | null,"updated_at": string,"visibility": Database["public"]['Enums']["route_visibility"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"color"?: string | null,"created_at"?: string,"gtfs_id"?: string | null,"id"?: string,"name": NonNullable<Json>,"operator_id": string,"short_name"?: string | null,"sort_order"?: number,"text_color"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["route_visibility"] | null
                  }
                  Update: {
                    "active"?: boolean,"color"?: string | null,"created_at"?: string,"gtfs_id"?: string | null,"id"?: string,"name"?: NonNullable<Json>,"operator_id"?: string,"short_name"?: string | null,"sort_order"?: number,"text_color"?: string | null,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["route_visibility"] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "route_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"route_recording": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ended_at": string | null,"id": string,"operator_id": string,"pattern_id": string | null,"started_at": string,"status": Database["public"]['Enums']["route_recording_status"],"suggested_stops": NonNullable<Json>,"track": unknown,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"id"?: string,"operator_id": string,"pattern_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["route_recording_status"],"suggested_stops"?: NonNullable<Json>,"track"?: unknown,"vehicle_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ended_at"?: string | null,"id"?: string,"operator_id"?: string,"pattern_id"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["route_recording_status"],"suggested_stops"?: NonNullable<Json>,"track"?: unknown,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "route_recording_operator_id_pattern_id_fkey"
      columns: ["operator_id","pattern_id"]
isOneToOne: false
      referencedRelation: "trip_pattern"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "route_recording_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"service_calendar": {
                  Row: {
                    "created_at": string,"end_date": string,"gtfs_id": string | null,"id": string,"name": string,"operator_id": string,"skip_national_holidays": boolean,"start_date": string,"updated_at": string,"weekdays": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date": string,"gtfs_id"?: string | null,"id"?: string,"name": string,"operator_id": string,"skip_national_holidays"?: boolean,"start_date": string,"updated_at"?: string,"weekdays": number
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string,"gtfs_id"?: string | null,"id"?: string,"name"?: string,"operator_id"?: string,"skip_national_holidays"?: boolean,"start_date"?: string,"updated_at"?: string,"weekdays"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_calendar_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"shape": {
                  Row: {
                    "created_at": string,"geom": unknown,"gtfs_id": string | null,"id": string,"operator_id": string,"source": Database["public"]['Enums']["shape_source"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"geom": unknown,"gtfs_id"?: string | null,"id"?: string,"operator_id": string,"source": Database["public"]['Enums']["shape_source"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"geom"?: unknown,"gtfs_id"?: string | null,"id"?: string,"operator_id"?: string,"source"?: Database["public"]['Enums']["shape_source"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shape_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"staff_role": {
                  Row: {
                    "created_at": string,"operator_id": string,"role": Database["public"]['Enums']["staff_role_kind"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"operator_id": string,"role": Database["public"]['Enums']["staff_role_kind"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"operator_id"?: string,"role"?: Database["public"]['Enums']["staff_role_kind"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_role_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"stop": {
                  Row: {
                    "created_at": string,"gtfs_id": string | null,"id": string,"location": unknown,"name": NonNullable<Json>,"notes": Json | null,"operator_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gtfs_id"?: string | null,"id"?: string,"location": unknown,"name": NonNullable<Json>,"notes"?: Json | null,"operator_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"gtfs_id"?: string | null,"id"?: string,"location"?: unknown,"name"?: NonNullable<Json>,"notes"?: Json | null,"operator_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stop_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"stop_event": {
                  Row: {
                    "approaching_at": string | null,"arrived_at": string | null,"departed_at": string | null,"eta": string | null,"operator_id": string,"passed_at": string | null,"state": Database["public"]['Enums']["stop_event_state"],"stop_sequence": number,"trip_instance_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "approaching_at"?: string | null,"arrived_at"?: string | null,"departed_at"?: string | null,"eta"?: string | null,"operator_id": string,"passed_at"?: string | null,"state"?: Database["public"]['Enums']["stop_event_state"],"stop_sequence": number,"trip_instance_id": string,"updated_at"?: string
                  }
                  Update: {
                    "approaching_at"?: string | null,"arrived_at"?: string | null,"departed_at"?: string | null,"eta"?: string | null,"operator_id"?: string,"passed_at"?: string | null,"state"?: Database["public"]['Enums']["stop_event_state"],"stop_sequence"?: number,"trip_instance_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stop_event_operator_id_trip_instance_id_fkey"
      columns: ["operator_id","trip_instance_id"]
isOneToOne: false
      referencedRelation: "trip_instance"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"subscription": {
                  Row: {
                    "created_at": string,"device_id": string,"id": string,"muted_until": string | null,"notify_passed": boolean,"operator_id": string,"pattern_id": string,"stop_sequence": number,"trigger": Database["public"]['Enums']["alert_trigger"],"trigger_value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device_id": string,"id"?: string,"muted_until"?: string | null,"notify_passed"?: boolean,"operator_id": string,"pattern_id": string,"stop_sequence": number,"trigger"?: Database["public"]['Enums']["alert_trigger"],"trigger_value"?: number
                  }
                  Update: {
                    "created_at"?: string,"device_id"?: string,"id"?: string,"muted_until"?: string | null,"notify_passed"?: boolean,"operator_id"?: string,"pattern_id"?: string,"stop_sequence"?: number,"trigger"?: Database["public"]['Enums']["alert_trigger"],"trigger_value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscription_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "device"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "subscription_operator_id_pattern_id_stop_sequence_fkey"
      columns: ["operator_id","pattern_id","stop_sequence"]
isOneToOne: false
      referencedRelation: "pattern_stop"
      referencedColumns: ["operator_id","pattern_id","stop_sequence"]
    }
                  ]
                },"tag": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"operator_id": string,"passenger_ref_encrypted": string | null,"tag_uid": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"operator_id": string,"passenger_ref_encrypted"?: string | null,"tag_uid": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"operator_id"?: string,"passenger_ref_encrypted"?: string | null,"tag_uid"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tag_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"trip": {
                  Row: {
                    "created_at": string,"gtfs_id": string | null,"headsign": Json | null,"id": string,"operator_id": string,"pattern_id": string,"service_calendar_id": string,"start_time": number,"updated_at": string,"vehicle_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"gtfs_id"?: string | null,"headsign"?: Json | null,"id"?: string,"operator_id": string,"pattern_id": string,"service_calendar_id": string,"start_time": number,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"gtfs_id"?: string | null,"headsign"?: Json | null,"id"?: string,"operator_id"?: string,"pattern_id"?: string,"service_calendar_id"?: string,"start_time"?: number,"updated_at"?: string,"vehicle_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_operator_id_pattern_id_fkey"
      columns: ["operator_id","pattern_id"]
isOneToOne: false
      referencedRelation: "trip_pattern"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_operator_id_service_calendar_id_fkey"
      columns: ["operator_id","service_calendar_id"]
isOneToOne: false
      referencedRelation: "service_calendar"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"trip_instance": {
                  Row: {
                    "created_at": string,"ended_at": string | null,"id": string,"kind": Database["public"]['Enums']["trip_instance_kind"],"last_confirmed_stop_sequence": number | null,"off_route_since": string | null,"operator_id": string,"pattern_id": string | null,"progress_at": string | null,"progress_m": number,"route_id": string | null,"service_date": string,"started_at": string | null,"started_by": Database["public"]['Enums']["trip_started_by"],"status": Database["public"]['Enums']["trip_instance_status"],"title": Json | null,"trip_id": string | null,"updated_at": string,"vehicle_id": string | null,"visible_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["trip_instance_kind"],"last_confirmed_stop_sequence"?: number | null,"off_route_since"?: string | null,"operator_id": string,"pattern_id"?: string | null,"progress_at"?: string | null,"progress_m"?: number,"route_id"?: string | null,"service_date": string,"started_at"?: string | null,"started_by"?: Database["public"]['Enums']["trip_started_by"],"status"?: Database["public"]['Enums']["trip_instance_status"],"title"?: Json | null,"trip_id"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null,"visible_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"ended_at"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["trip_instance_kind"],"last_confirmed_stop_sequence"?: number | null,"off_route_since"?: string | null,"operator_id"?: string,"pattern_id"?: string | null,"progress_at"?: string | null,"progress_m"?: number,"route_id"?: string | null,"service_date"?: string,"started_at"?: string | null,"started_by"?: Database["public"]['Enums']["trip_started_by"],"status"?: Database["public"]['Enums']["trip_instance_status"],"title"?: Json | null,"trip_id"?: string | null,"updated_at"?: string,"vehicle_id"?: string | null,"visible_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_instance_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_instance_operator_id_pattern_id_fkey"
      columns: ["operator_id","pattern_id"]
isOneToOne: false
      referencedRelation: "trip_pattern"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_instance_operator_id_route_id_fkey"
      columns: ["operator_id","route_id"]
isOneToOne: false
      referencedRelation: "route"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_instance_operator_id_trip_id_fkey"
      columns: ["operator_id","trip_id"]
isOneToOne: false
      referencedRelation: "trip"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_instance_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"trip_pattern": {
                  Row: {
                    "created_at": string,"direction": number | null,"id": string,"name": string,"operator_id": string,"route_id": string,"shape_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"direction"?: number | null,"id"?: string,"name": string,"operator_id": string,"route_id": string,"shape_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"direction"?: number | null,"id"?: string,"name"?: string,"operator_id"?: string,"route_id"?: string,"shape_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "trip_pattern_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "trip_pattern_operator_id_route_id_fkey"
      columns: ["operator_id","route_id"]
isOneToOne: false
      referencedRelation: "route"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "trip_pattern_operator_id_shape_id_fkey"
      columns: ["operator_id","shape_id"]
isOneToOne: false
      referencedRelation: "shape"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"vehicle": {
                  Row: {
                    "active": boolean,"capacity": number | null,"created_at": string,"id": string,"name": string,"operator_id": string,"traccar_device_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"capacity"?: number | null,"created_at"?: string,"id"?: string,"name": string,"operator_id": string,"traccar_device_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"capacity"?: number | null,"created_at"?: string,"id"?: string,"name"?: string,"operator_id"?: string,"traccar_device_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_credential": {
                  Row: {
                    "created_at": string,"id": string,"label": string | null,"last_used_at": string | null,"operator_id": string,"revoked_at": string | null,"token_hash": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label"?: string | null,"last_used_at"?: string | null,"operator_id": string,"revoked_at"?: string | null,"token_hash": string,"vehicle_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string | null,"last_used_at"?: string | null,"operator_id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_credential_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"vehicle_event": {
                  Row: {
                    "id": string,"occurred_at": string,"operator_id": string,"payload": NonNullable<Json>,"received_at": string,"type": Database["public"]['Enums']["vehicle_event_type"],"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"occurred_at": string,"operator_id": string,"payload"?: NonNullable<Json>,"received_at"?: string,"type": Database["public"]['Enums']["vehicle_event_type"],"vehicle_id": string
                  }
                  Update: {
                    "id"?: string,"occurred_at"?: string,"operator_id"?: string,"payload"?: NonNullable<Json>,"received_at"?: string,"type"?: Database["public"]['Enums']["vehicle_event_type"],"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_event_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                },"vehicle_state": {
                  Row: {
                    "accuracy_m": number | null,"heading": number | null,"location": unknown,"operator_id": string,"recorded_at": string,"speed_kmh": number | null,"trip_instance_id": string | null,"updated_at": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"location"?: unknown,"operator_id": string,"recorded_at": string,"speed_kmh"?: number | null,"trip_instance_id"?: string | null,"updated_at"?: string,"vehicle_id": string
                  }
                  Update: {
                    "accuracy_m"?: number | null,"heading"?: number | null,"location"?: unknown,"operator_id"?: string,"recorded_at"?: string,"speed_kmh"?: number | null,"trip_instance_id"?: string | null,"updated_at"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_state_operator_id_trip_instance_id_fkey"
      columns: ["operator_id","trip_instance_id"]
isOneToOne: false
      referencedRelation: "trip_instance"
      referencedColumns: ["operator_id","id"]
    },{
      foreignKeyName: "vehicle_state_operator_id_vehicle_id_fkey"
      columns: ["operator_id","vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicle"
      referencedColumns: ["operator_id","id"]
    }
                  ]
                }
          }
          Views: {
            "stop_location": {
                  Row: {
                    "id": string,"location": unknown,"operator_id": string
                  }
                  ComputedFields: never
                  Insert: {
                           "id"?: string | null,"location"?: unknown,"operator_id"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"location"?: unknown,"operator_id"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "stop_operator_id_fkey"
      columns: ["operator_id"]
isOneToOne: false
      referencedRelation: "operator"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "create_invite_code":
{ Args: { "p_audience_id": string,"p_expires_at"?: string,"p_label"?: string,"p_max_uses"?: number }; Returns: {
              "code": string,"invite_code_id": string
            }[]
                           },
"redeem_invite_code":
{ Args: { "p_code": string }; Returns: {
              "audience_id": string,"operator_id": string,"status": string
            }[]
                           }
          }
          Enums: {
            "alert_kind": "approaching"|"passed"|"delayed"|"cancelled","alert_trigger": "minutes"|"stops","boarding_event_kind": "boarded"|"alighted"|"on_board_at_trip_end","calendar_exception_type": "added"|"removed","device_platform": "ios"|"android"|"web","route_recording_status": "recording"|"review"|"converted"|"discarded","route_visibility": "public"|"invited_map"|"invited_eta","shape_source": "recording"|"drawn"|"import","staff_role_kind": "owner"|"editor"|"driver","stop_event_state": "upcoming"|"approaching"|"arrived"|"departed"|"passed","trip_instance_kind": "scheduled"|"live","trip_instance_status": "planned"|"active"|"completed"|"cancelled","trip_started_by": "schedule"|"driver","vehicle_event_type": "tag_seen"|"tag_gone"|"tags_on_board"|"device_health"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "alert_kind": ["approaching", "passed", "delayed", "cancelled"],"alert_trigger": ["minutes", "stops"],"boarding_event_kind": ["boarded", "alighted", "on_board_at_trip_end"],"calendar_exception_type": ["added", "removed"],"device_platform": ["ios", "android", "web"],"route_recording_status": ["recording", "review", "converted", "discarded"],"route_visibility": ["public", "invited_map", "invited_eta"],"shape_source": ["recording", "drawn", "import"],"staff_role_kind": ["owner", "editor", "driver"],"stop_event_state": ["upcoming", "approaching", "arrived", "departed", "passed"],"trip_instance_kind": ["scheduled", "live"],"trip_instance_status": ["planned", "active", "completed", "cancelled"],"trip_started_by": ["schedule", "driver"],"vehicle_event_type": ["tag_seen", "tag_gone", "tags_on_board", "device_health"]
          }
        }
} as const
