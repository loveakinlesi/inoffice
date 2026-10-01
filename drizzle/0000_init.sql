-- IF NOT EXISTS: the migrator creates this schema first to hold its history table.
CREATE SCHEMA IF NOT EXISTS "inoffice";
--> statement-breakpoint
CREATE TYPE "inoffice"."attendance_mode" AS ENUM('percentage', 'days');--> statement-breakpoint
CREATE TYPE "inoffice"."region" AS ENUM('england-and-wales', 'scotland', 'northern-ireland');--> statement-breakpoint
CREATE TYPE "inoffice"."status" AS ENUM('home', 'office', 'ooo', 'sick', 'bank');--> statement-breakpoint
CREATE TABLE "inoffice"."attendance_entries" (
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"status" "inoffice"."status" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_entries_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "inoffice"."user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"attendance_mode" "inoffice"."attendance_mode" DEFAULT 'percentage' NOT NULL,
	"target_percentage" real DEFAULT 50 NOT NULL,
	"target_days_per_week" real,
	"region" "inoffice"."region" DEFAULT 'england-and-wales' NOT NULL,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
