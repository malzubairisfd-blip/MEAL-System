// src/app/api/bnf-cash-disturbance/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-cash-disturbance.db");
const getEnrollmentDbPath = () => path.join(getDataPath(), "enrollment-review.db");

const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT, 
    project_name TEXT, 
    benef_id TEXT UNIQUE, 
    bnf_name TEXT, 
    bnf_vill TEXT, 
    bnf_ozla TEXT, 
    bnf_mud  TEXT, 
    ed_id TEXT, 
    ed_name TEXT,
    pc_id TEXT,
    pc_name TEXT,
    is_pay_list_s1 INTEGER, pay_cyc_cnt_s1 INTEGER, pay_cyc_mon_list_s1 INTEGER, pay_amt_s1 INTEGER, is_cashed_s1 INTEGER, cashed_amt_s1 INTEGER, is_uncashed_s1 INTEGER, uncashed_amt_s1 INTEGER, uncashed_code_s1 INTEGER, uncashed_reason_s1 TEXT, recom_s1 TEXT,
    is_pay_list_s2 INTEGER, pay_cyc_cnt_s2 INTEGER, pay_cyc_mon_list_s2 INTEGER, pay_amt_s2 INTEGER, is_cashed_s2 INTEGER, cashed_amt_s2 INTEGER, is_uncashed_s2 INTEGER, uncashed_amt_s2 INTEGER, uncashed_code_s2 INTEGER, uncashed_reason_s2 TEXT, recom_s2 TEXT,
    is_pay_list_s3 INTEGER, pay_cyc_cnt_s3 INTEGER, pay_cyc_mon_list_s3 INTEGER, pay_amt_s3 INTEGER, is_cashed_s3 INTEGER, cashed_amt_s3 INTEGER, is_uncashed_s3 INTEGER, uncashed_amt_s3 INTEGER, uncashed_code_s3 INTEGER, uncashed_reason_s3 TEXT, recom_s3 TEXT,
    is_pay_list_s4 INTEGER, pay_cyc_cnt_s4 INTEGER, pay_cyc_mon_list_s4 INTEGER, pay_amt_s4 INTEGER, is_cashed_s4 INTEGER, cashed_amt_s4 INTEGER, is_uncashed_s4 INTEGER, uncashed_amt_s4 INTEGER, uncashed_code_s4 INTEGER, uncashed_reason_s4 TEXT, recom_s4 TEXT,
    is_pay_list_s5 INTEGER, pay_cyc_cnt_s5 INTEGER, pay_cyc_mon_list_s5 INTEGER, pay_amt_s5 INTEGER, is_cashed_s5 INTEGER, cashed_amt_s5 INTEGER, is_uncashed_s5 INTEGER, uncashed_amt_s5 INTEGER, uncashed_code_s5 INTEGER, uncashed_reason_s5 TEXT, recom_s5 TEXT,
    is_pay_list_s6 INTEGER, pay_cyc_cnt_s6 INTEGER, pay_cyc_mon_list_s6 INTEGER, pay_amt_s6 INTEGER, is_cashed_s6 INTEGER, cashed_amt_s6 INTEGER, is_uncashed_s6 INTEGER, uncashed_amt_s6 INTEGER, uncashed_code_s6 INTEGER, uncashed_reason_s6 TEXT, recom_s6 TEXT,
    is_pay_list_s7 INTEGER, pay_cyc_cnt_s7 INTEGER, pay_cyc_mon_list_s7 INTEGER, pay_amt_s7 INTEGER, is_cashed_s7 INTEGER, cashed_amt_s7 INTEGER, is_uncashed_s7 INTEGER, uncashed_amt_s7 INTEGER, uncashed_code_s7 INTEGER, uncashed_reason_s7 TEXT, recom_s7 TEXT,
    is_pay_list_s8 INTEGER, pay_cyc_cnt_s8 INTEGER, pay_cyc_mon_list_s8 INTEGER, pay_amt_s8 INTEGER, is_cashed_s8 INTEGER, cashed_amt_s8 INTEGER, is_uncashed_s8 INTEGER, uncashed_amt_s8 INTEGER, uncashed_code_s8 INTEGER, uncashed_reason_s8 TEXT, recom_s8 TEXT,
    is_pay_list_s9 INTEGER, pay_cyc_cnt_s9 INTEGER, pay_cyc_mon_list_s9 INTEGER, pay_amt_s9 INTEGER, is_cashed_s9 INTEGER, cashed_amt_s9 INTEGER, is_uncashed_s9 INTEGER, uncashed_amt_s9 INTEGER, uncashed_code_s9 INTEGER, uncashed_reason_s9 TEXT, recom_s9 TEXT,
    is_pay_list_s10 INTEGER, pay_cyc_cnt_s10 INTEGER, pay_cyc_mon_list_s10 INTEGER, pay_amt_s10 INTEGER, is_cashed_s10 INTEGER, cashed_amt_s10 INTEGER, is_uncashed_s10 INTEGER, uncashed_amt_s10 INTEGER, uncashed_code_s10 INTEGER, uncashed_reason_s10 TEXT, recom_s10 TEXT,
    is_pay_list_s11 INTEGER, pay_cyc_cnt_s11 INTEGER, pay_cyc_mon_list_s11 INTEGER, pay_amt_s11 INTEGER, is_cashed_s11 INTEGER, cashed_amt_s11 INTEGER, is_uncashed_s11 INTEGER, uncashed_amt_s11 INTEGER, uncashed_code_s11 INTEGER, uncashed_reason_s11 TEXT, recom_s11 TEXT,
    is_pay_list_s12 INTEGER, pay_cyc_cnt_s12 INTEGER, pay_cyc_mon_list_s12 INTEGER, pay_amt_s12 INTEGER, is_cashed_s12 INTEGER, cashed_amt_s12 INTEGER, is_uncashed_s12 INTEGER, uncashed_amt_s12 INTEGER, uncashed_code_s12 INTEGER, uncashed_reason_s12 TEXT, recom_s12 TEXT,
    is_pay_list_s13 INTEGER, pay_cyc_cnt_s13 INTEGER, pay_cyc_mon_list_s13 INTEGER, pay_amt_s13 INTEGER, is_cashed_s13 INTEGER, cashed_amt_s13 INTEGER, is_uncashed_s13 INTEGER, uncashed_amt_s13 INTEGER, uncashed_code_s13 INTEGER, uncashed_reason_s13 TEXT, recom_s13 TEXT,
    is_pay_list_s14 INTEGER, pay_cyc_cnt_s14 INTEGER, pay_cyc_mon_list_s14 INTEGER, pay_amt_s14 INTEGER, is_cashed_s14 INTEGER, cashed_amt_s14 INTEGER, is_uncashed_s14 INTEGER, uncashed_amt_s14 INTEGER, uncashed_code_s14 INTEGER, uncashed_reason_s14 TEXT, recom_s14 TEXT,
    is_pay_list_s15 INTEGER, pay_cyc_cnt_s15 INTEGER, pay_cyc_mon_list_s15 INTEGER, pay_amt_s15 INTEGER, is_cashed_s15 INTEGER, cashed_amt_s15 INTEGER, is_uncashed_s15 INTEGER, uncashed_amt_s15 INTEGER, uncashed_code_s15 INTEGER, uncashed_reason_s15 TEXT, recom_s15 TEXT,
    is_pay_list_s16 INTEGER, pay_cyc_cnt_s16 INTEGER, pay_cyc_mon_list_s16 INTEGER, pay_amt_s16 INTEGER, is_cashed_s16 INTEGER, cashed_amt_s16 INTEGER, is_uncashed_s16 INTEGER, uncashed_amt_s16 INTEGER, uncashed_code_s16 INTEGER, uncashed_reason_s16 TEXT, recom_s16 TEXT,
    is_pay_list_s17 INTEGER, pay_cyc_cnt_s17 INTEGER, pay_cyc_mon_list_s17 INTEGER, pay_amt_s17 INTEGER, is_cashed_s17 INTEGER, cashed_amt_s17 INTEGER, is_uncashed_s17 INTEGER, uncashed_amt_s17 INTEGER, uncashed_code_s17 INTEGER, uncashed_reason_s17 TEXT, recom_s17 TEXT,
    is_pay_list_s18 INTEGER, pay_cyc_cnt_s18 INTEGER, pay_cyc_mon_list_s18 INTEGER, pay_amt_s18 INTEGER, is_cashed_s18 INTEGER, cashed_amt_s18 INTEGER, is_uncashed_s18 INTEGER, uncashed_amt_s18 INTEGER, uncashed_code_s18 INTEGER, uncashed_reason_s18 TEXT, recom_s18 TEXT,
    is_pay_list_s19 INTEGER, pay_cyc_cnt_s19 INTEGER, pay_cyc_mon_list_s19 INTEGER, pay_amt_s19 INTEGER, is_cashed_s19 INTEGER, cashed_amt_s19 INTEGER, is_uncashed_s19 INTEGER, uncashed_amt_s19 INTEGER, uncashed_code_s19 INTEGER, uncashed_reason_s19 TEXT, recom_s19 TEXT,
    is_pay_list_s20 INTEGER, pay_cyc_cnt_s20 INTEGER, pay_cyc_mon_list_s20 INTEGER, pay_amt_s20 INTEGER, is_cashed_s20 INTEGER, cashed_amt_s20 INTEGER, is_uncashed_s20 INTEGER, uncashed_amt_s20 INTEGER, uncashed_code_s20 INTEGER, uncashed_reason_s20 TEXT, recom_s20 TEXT,
    is_pay_list_s21 INTEGER, pay_cyc_cnt_s21 INTEGER, pay_cyc_mon_list_s21 INTEGER, pay_amt_s21 INTEGER, is_cashed_s21 INTEGER, cashed_amt_s21 INTEGER, is_uncashed_s21 INTEGER, uncashed_amt_s21 INTEGER, uncashed_code_s21 INTEGER, uncashed_reason_s21 TEXT, recom_s21 TEXT,
    is_pay_list_s22 INTEGER, pay_cyc_cnt_s22 INTEGER, pay_cyc_mon_list_s22 INTEGER, pay_amt_s22 INTEGER, is_cashed_s22 INTEGER, cashed_amt_s22 INTEGER, is_uncashed_s22 INTEGER, uncashed_amt_s22 INTEGER, uncashed_code_s22 INTEGER, uncashed_reason_s22 TEXT, recom_s22 TEXT,
    is_pay_list_s23 INTEGER, pay_cyc_cnt_s23 INTEGER, pay_cyc_mon_list_s23 INTEGER, pay_amt_s23 INTEGER, is_cashed_s23 INTEGER, cashed_amt_s23 INTEGER, is_uncashed_s23 INTEGER, uncashed_amt_s23 INTEGER, uncashed_code_s23 INTEGER, uncashed_reason_s23 TEXT, recom_s23 TEXT,
    is_pay_list_s24 INTEGER, pay_cyc_cnt_s24 INTEGER, pay_cyc_mon_list_s24 INTEGER, pay_amt_s24 INTEGER, is_cashed_s24 INTEGER, cashed_amt_s24 INTEGER, is_uncashed_s24 INTEGER, uncashed_amt_s24 INTEGER, uncashed_code_s24 INTEGER, uncashed_reason_s24 TEXT, recom_s24 TEXT,
    is_pay_list_s25 INTEGER, pay_cyc_cnt_s25 INTEGER, pay_cyc_mon_list_s25 INTEGER, pay_amt_s25 INTEGER, is_cashed_s25 INTEGER, cashed_amt_s25 INTEGER, is_uncashed_s25 INTEGER, uncashed_amt_s25 INTEGER, uncashed_code_s25 INTEGER, uncashed_reason_s25 TEXT, recom_s25 TEXT,
    is_pay_list_s26 INTEGER, pay_cyc_cnt_s26 INTEGER, pay_cyc_mon_list_s26 INTEGER, pay_amt_s26 INTEGER, is_cashed_s26 INTEGER, cashed_amt_s26 INTEGER, is_uncashed_s26 INTEGER, uncashed_amt_s26 INTEGER, uncashed_code_s26 INTEGER, uncashed_reason_s26 TEXT, recom_s26 TEXT,
    is_pay_list_s27 INTEGER, pay_cyc_cnt_s27 INTEGER, pay_cyc_mon_list_s27 INTEGER, pay_amt_s27 INTEGER, is_cashed_s27 INTEGER, cashed_amt_s27 INTEGER, is_uncashed_s27 INTEGER, uncashed_amt_s27 INTEGER, uncashed_code_s27 INTEGER, uncashed_reason_s27 TEXT, recom_s27 TEXT,
    is_pay_list_s28 INTEGER, pay_cyc_cnt_s28 INTEGER, pay_cyc_mon_list_s28 INTEGER, pay_amt_s28 INTEGER, is_cashed_s28 INTEGER, cashed_amt_s28 INTEGER, is_uncashed_s28 INTEGER, uncashed_amt_s28 INTEGER, uncashed_code_s28 INTEGER, uncashed_reason_s28 TEXT, recom_s28 TEXT,
    is_pay_list_s29 INTEGER, pay_cyc_cnt_s29 INTEGER, pay_cyc_mon_list_s29 INTEGER, pay_amt_s29 INTEGER, is_cashed_s29 INTEGER, cashed_amt_s29 INTEGER, is_uncashed_s29 INTEGER, uncashed_amt_s29 INTEGER, uncashed_code_s29 INTEGER, uncashed_reason_s29 TEXT, recom_s29 TEXT,
    is_pay_list_s30 INTEGER, pay_cyc_cnt_s30 INTEGER, pay_cyc_mon_list_s30 INTEGER, pay_amt_s30 INTEGER, is_cashed_s30 INTEGER, cashed_amt_s30 INTEGER, is_uncashed_s30 INTEGER, uncashed_amt_s30 INTEGER, uncashed_code_s30 INTEGER, uncashed_reason_s30 TEXT, recom_s30 TEXT,
    is_pay_list_s31 INTEGER, pay_cyc_cnt_s31 INTEGER, pay_cyc_mon_list_s31 INTEGER, pay_amt_s31 INTEGER, is_cashed_s31 INTEGER, cashed_amt_s31 INTEGER, is_uncashed_s31 INTEGER, uncashed_amt_s31 INTEGER, uncashed_code_s31 INTEGER, uncashed_reason_s31 TEXT, recom_s31 TEXT,
    is_pay_list_s32 INTEGER, pay_cyc_cnt_s32 INTEGER, pay_cyc_mon_list_s32 INTEGER, pay_amt_s32 INTEGER, is_cashed_s32 INTEGER, cashed_amt_s32 INTEGER, is_uncashed_s32 INTEGER, uncashed_amt_s32 INTEGER, uncashed_code_s32 INTEGER, uncashed_reason_s32 TEXT, recom_s32 TEXT,
    is_pay_list_s33 INTEGER, pay_cyc_cnt_s33 INTEGER, pay_cyc_mon_list_s33 INTEGER, pay_amt_s33 INTEGER, is_cashed_s33 INTEGER, cashed_amt_s33 INTEGER, is_uncashed_s33 INTEGER, uncashed_amt_s33 INTEGER, uncashed_code_s33 INTEGER, uncashed_reason_s33 TEXT, recom_s33 TEXT,
    is_pay_list_s34 INTEGER, pay_cyc_cnt_s34 INTEGER, pay_cyc_mon_list_s34 INTEGER, pay_amt_s34 INTEGER, is_cashed_s34 INTEGER, cashed_amt_s34 INTEGER, is_uncashed_s34 INTEGER, uncashed_amt_s34 INTEGER, uncashed_code_s34 INTEGER, uncashed_reason_s34 TEXT, recom_s34 TEXT,
    is_pay_list_s35 INTEGER, pay_cyc_cnt_s35 INTEGER, pay_cyc_mon_list_s35 INTEGER, pay_amt_s35 INTEGER, is_cashed_s35 INTEGER, cashed_amt_s35 INTEGER, is_uncashed_s35 INTEGER, uncashed_amt_s35 INTEGER, uncashed_code_s35 INTEGER, uncashed_reason_s35 TEXT, recom_s35 TEXT,
    is_pay_list_s36 INTEGER, pay_cyc_cnt_s36 INTEGER, pay_cyc_mon_list_s36 INTEGER, pay_amt_s36 INTEGER, is_cashed_s36 INTEGER, cashed_amt_s36 INTEGER, is_uncashed_s36 INTEGER, uncashed_amt_s36 INTEGER, uncashed_code_s36 INTEGER, uncashed_reason_s36 TEXT, recom_s36 TEXT,
    is_pay_list_s37 INTEGER, pay_cyc_cnt_s37 INTEGER, pay_cyc_mon_list_s37 INTEGER, pay_amt_s37 INTEGER, is_cashed_s37 INTEGER, cashed_amt_s37 INTEGER, is_uncashed_s37 INTEGER, uncashed_amt_s37 INTEGER, uncashed_code_s37 INTEGER, uncashed_reason_s37 TEXT, recom_s37 TEXT,
    is_pay_list_s38 INTEGER, pay_cyc_cnt_s38 INTEGER, pay_cyc_mon_list_s38 INTEGER, pay_amt_s38 INTEGER, is_cashed_s38 INTEGER, cashed_amt_s38 INTEGER, is_uncashed_s38 INTEGER, uncashed_amt_s38 INTEGER, uncashed_code_s38 INTEGER, uncashed_reason_s38 TEXT, recom_s38 TEXT,
    is_pay_list_s39 INTEGER, pay_cyc_cnt_s39 INTEGER, pay_cyc_mon_list_s39 INTEGER, pay_amt_s39 INTEGER, is_cashed_s39 INTEGER, cashed_amt_s39 INTEGER, is_uncashed_s39 INTEGER, uncashed_amt_s39 INTEGER, uncashed_code_s39 INTEGER, uncashed_reason_s39 TEXT, recom_s39 TEXT,
    is_pay_list_s40 INTEGER, pay_cyc_cnt_s40 INTEGER, pay_cyc_mon_list_s40 INTEGER, pay_amt_s40 INTEGER, is_cashed_s40 INTEGER, cashed_amt_s40 INTEGER, is_uncashed_s40 INTEGER, uncashed_amt_s40 INTEGER, uncashed_code_s40 INTEGER, uncashed_reason_s40 TEXT, recom_s40 TEXT,
    is_pay_list_s41 INTEGER, pay_cyc_cnt_s41 INTEGER, pay_cyc_mon_list_s41 INTEGER, pay_amt_s41 INTEGER, is_cashed_s41 INTEGER, cashed_amt_s41 INTEGER, is_uncashed_s41 INTEGER, uncashed_amt_s41 INTEGER, uncashed_code_s41 INTEGER, uncashed_reason_s41 TEXT, recom_s41 TEXT,
    is_pay_list_s42 INTEGER, pay_cyc_cnt_s42 INTEGER, pay_cyc_mon_list_s42 INTEGER, pay_amt_s42 INTEGER, is_cashed_s42 INTEGER, cashed_amt_s42 INTEGER, is_uncashed_s42 INTEGER, uncashed_amt_s42 INTEGER, uncashed_code_s42 INTEGER, uncashed_reason_s42 TEXT, recom_s42 TEXT,
    is_pay_list_s43 INTEGER, pay_cyc_cnt_s43 INTEGER, pay_cyc_mon_list_s43 INTEGER, pay_amt_s43 INTEGER, is_cashed_s43 INTEGER, cashed_amt_s43 INTEGER, is_uncashed_s43 INTEGER, uncashed_amt_s43 INTEGER, uncashed_code_s43 INTEGER, uncashed_reason_s43 TEXT, recom_s43 TEXT,
    is_pay_list_s44 INTEGER, pay_cyc_cnt_s44 INTEGER, pay_cyc_mon_list_s44 INTEGER, pay_amt_s44 INTEGER, is_cashed_s44 INTEGER, cashed_amt_s44 INTEGER, is_uncashed_s44 INTEGER, uncashed_amt_s44 INTEGER, uncashed_code_s44 INTEGER, uncashed_reason_s44 TEXT, recom_s44 TEXT,
    is_pay_list_s45 INTEGER, pay_cyc_cnt_s45 INTEGER, pay_cyc_mon_list_s45 INTEGER, pay_amt_s45 INTEGER, is_cashed_s45 INTEGER, cashed_amt_s45 INTEGER, is_uncashed_s45 INTEGER, uncashed_amt_s45 INTEGER, uncashed_code_s45 INTEGER, uncashed_reason_s45 TEXT, recom_s45 TEXT,
    is_pay_list_s46 INTEGER, pay_cyc_cnt_s46 INTEGER, pay_cyc_mon_list_s46 INTEGER, pay_amt_s46 INTEGER, is_cashed_s46 INTEGER, cashed_amt_s46 INTEGER, is_uncashed_s46 INTEGER, uncashed_amt_s46 INTEGER, uncashed_code_s46 INTEGER, uncashed_reason_s46 TEXT, recom_s46 TEXT,
    is_pay_list_s47 INTEGER, pay_cyc_cnt_s47 INTEGER, pay_cyc_mon_list_s47 INTEGER, pay_amt_s47 INTEGER, is_cashed_s47 INTEGER, cashed_amt_s47 INTEGER, is_uncashed_s47 INTEGER, uncashed_amt_s47 INTEGER, uncashed_code_s47 INTEGER, uncashed_reason_s47 TEXT, recom_s47 TEXT,
    is_pay_list_s48 INTEGER, pay_cyc_cnt_s48 INTEGER, pay_cyc_mon_list_s48 INTEGER, pay_amt_s48 INTEGER, is_cashed_s48 INTEGER, cashed_amt_s48 INTEGER, is_uncashed_s48 INTEGER, uncashed_amt_s48 INTEGER, uncashed_code_s48 INTEGER, uncashed_reason_s48 TEXT, recom_s48 TEXT,
    is_pay_list_s49 INTEGER, pay_cyc_cnt_s49 INTEGER, pay_cyc_mon_list_s49 INTEGER, pay_amt_s49 INTEGER, is_cashed_s49 INTEGER, cashed_amt_s49 INTEGER, is_uncashed_s49 INTEGER, uncashed_amt_s49 INTEGER, uncashed_code_s49 INTEGER, uncashed_reason_s49 TEXT, recom_s49 TEXT,
    is_pay_list_s50 INTEGER, pay_cyc_cnt_s50 INTEGER, pay_cyc_mon_list_s50 INTEGER, pay_amt_s50 INTEGER, is_cashed_s50 INTEGER, cashed_amt_s50 INTEGER, is_uncashed_s50 INTEGER, uncashed_amt_s50 INTEGER, uncashed_code_s50 INTEGER, uncashed_reason_s50 TEXT, recom_s50 TEXT,
    is_pay_list_s51 INTEGER, pay_cyc_cnt_s51 INTEGER, pay_cyc_mon_list_s51 INTEGER, pay_amt_s51 INTEGER, is_cashed_s51 INTEGER, cashed_amt_s51 INTEGER, is_uncashed_s51 INTEGER, uncashed_amt_s51 INTEGER, uncashed_code_s51 INTEGER, uncashed_reason_s51 TEXT, recom_s51 TEXT,
    is_pay_list_s52 INTEGER, pay_cyc_cnt_s52 INTEGER, pay_cyc_mon_list_s52 INTEGER, pay_amt_s52 INTEGER, is_cashed_s52 INTEGER, cashed_amt_s52 INTEGER, is_uncashed_s52 INTEGER, uncashed_amt_s52 INTEGER, uncashed_code_s52 INTEGER, uncashed_reason_s52 TEXT, recom_s52 TEXT,
    is_pay_list_s53 INTEGER, pay_cyc_cnt_s53 INTEGER, pay_cyc_mon_list_s53 INTEGER, pay_amt_s53 INTEGER, is_cashed_s53 INTEGER, cashed_amt_s53 INTEGER, is_uncashed_s53 INTEGER, uncashed_amt_s53 INTEGER, uncashed_code_s53 INTEGER, uncashed_reason_s53 TEXT, recom_s53 TEXT,
    is_pay_list_s54 INTEGER, pay_cyc_cnt_s54 INTEGER, pay_cyc_mon_list_s54 INTEGER, pay_amt_s54 INTEGER, is_cashed_s54 INTEGER, cashed_amt_s54 INTEGER, is_uncashed_s54 INTEGER, uncashed_amt_s54 INTEGER, uncashed_code_s54 INTEGER, uncashed_reason_s54 TEXT, recom_s54 TEXT,
    is_pay_list_s55 INTEGER, pay_cyc_cnt_s55 INTEGER, pay_cyc_mon_list_s55 INTEGER, pay_amt_s55 INTEGER, is_cashed_s55 INTEGER, cashed_amt_s55 INTEGER, is_uncashed_s55 INTEGER, uncashed_amt_s55 INTEGER, uncashed_code_s55 INTEGER, uncashed_reason_s55 TEXT, recom_s55 TEXT,
    is_pay_list_s56 INTEGER, pay_cyc_cnt_s56 INTEGER, pay_cyc_mon_list_s56 INTEGER, pay_amt_s56 INTEGER, is_cashed_s56 INTEGER, cashed_amt_s56 INTEGER, is_uncashed_s56 INTEGER, uncashed_amt_s56 INTEGER, uncashed_code_s56 INTEGER, uncashed_reason_s56 TEXT, recom_s56 TEXT,
    is_pay_list_s57 INTEGER, pay_cyc_cnt_s57 INTEGER, pay_cyc_mon_list_s57 INTEGER, pay_amt_s57 INTEGER, is_cashed_s57 INTEGER, cashed_amt_s57 INTEGER, is_uncashed_s57 INTEGER, uncashed_amt_s57 INTEGER, uncashed_code_s57 INTEGER, uncashed_reason_s57 TEXT, recom_s57 TEXT,
    is_pay_list_s58 INTEGER, pay_cyc_cnt_s58 INTEGER, pay_cyc_mon_list_s58 INTEGER, pay_amt_s58 INTEGER, is_cashed_s58 INTEGER, cashed_amt_s58 INTEGER, is_uncashed_s58 INTEGER, uncashed_amt_s58 INTEGER, uncashed_code_s58 INTEGER, uncashed_reason_s58 TEXT, recom_s58 TEXT,
    is_pay_list_s59 INTEGER, pay_cyc_cnt_s59 INTEGER, pay_cyc_mon_list_s59 INTEGER, pay_amt_s59 INTEGER, is_cashed_s59 INTEGER, cashed_amt_s59 INTEGER, is_uncashed_s59 INTEGER, uncashed_amt_s59 INTEGER, uncashed_code_s59 INTEGER, uncashed_reason_s59 TEXT, recom_s59 TEXT,
    is_pay_list_s60 INTEGER, pay_cyc_cnt_s60 INTEGER, pay_cyc_mon_list_s60 INTEGER, pay_amt_s60 INTEGER, is_cashed_s60 INTEGER, cashed_amt_s60 INTEGER, is_uncashed_s60 INTEGER, uncashed_amt_s60 INTEGER, uncashed_code_s60 INTEGER, uncashed_reason_s60 TEXT, recom_s60 TEXT,
    is_pay_list_s61 INTEGER, pay_cyc_cnt_s61 INTEGER, pay_cyc_mon_list_s61 INTEGER, pay_amt_s61 INTEGER, is_cashed_s61 INTEGER, cashed_amt_s61 INTEGER, is_uncashed_s61 INTEGER, uncashed_amt_s61 INTEGER, uncashed_code_s61 INTEGER, uncashed_reason_s61 TEXT, recom_s61 TEXT,
    is_pay_list_s62 INTEGER, pay_cyc_cnt_s62 INTEGER, pay_cyc_mon_list_s62 INTEGER, pay_amt_s62 INTEGER, is_cashed_s62 INTEGER, cashed_amt_s62 INTEGER, is_uncashed_s62 INTEGER, uncashed_amt_s62 INTEGER, uncashed_code_s62 INTEGER, uncashed_reason_s62 TEXT, recom_s62 TEXT,
    is_pay_list_s63 INTEGER, pay_cyc_cnt_s63 INTEGER, pay_cyc_mon_list_s63 INTEGER, pay_amt_s63 INTEGER, is_cashed_s63 INTEGER, cashed_amt_s63 INTEGER, is_uncashed_s63 INTEGER, uncashed_amt_s63 INTEGER, uncashed_code_s63 INTEGER, uncashed_reason_s63 TEXT, recom_s63 TEXT,
    is_pay_list_s64 INTEGER, pay_cyc_cnt_s64 INTEGER, pay_cyc_mon_list_s64 INTEGER, pay_amt_s64 INTEGER, is_cashed_s64 INTEGER, cashed_amt_s64 INTEGER, is_uncashed_s64 INTEGER, uncashed_amt_s64 INTEGER, uncashed_code_s64 INTEGER, uncashed_reason_s64 TEXT, recom_s64 TEXT,
    is_pay_list_s65 INTEGER, pay_cyc_cnt_s65 INTEGER, pay_cyc_mon_list_s65 INTEGER, pay_amt_s65 INTEGER, is_cashed_s65 INTEGER, cashed_amt_s65 INTEGER, is_uncashed_s65 INTEGER, uncashed_amt_s65 INTEGER, uncashed_code_s65 INTEGER, uncashed_reason_s65 TEXT, recom_s65 TEXT,
    is_pay_list_s66 INTEGER, pay_cyc_cnt_s66 INTEGER, pay_cyc_mon_list_s66 INTEGER, pay_amt_s66 INTEGER, is_cashed_s66 INTEGER, cashed_amt_s66 INTEGER, is_uncashed_s66 INTEGER, uncashed_amt_s66 INTEGER, uncashed_code_s66 INTEGER, uncashed_reason_s66 TEXT, recom_s66 TEXT,
    is_pay_list_s67 INTEGER, pay_cyc_cnt_s67 INTEGER, pay_cyc_mon_list_s67 INTEGER, pay_amt_s67 INTEGER, is_cashed_s67 INTEGER, cashed_amt_s67 INTEGER, is_uncashed_s67 INTEGER, uncashed_amt_s67 INTEGER, uncashed_code_s67 INTEGER, uncashed_reason_s67 TEXT, recom_s67 TEXT,
    is_pay_list_s68 INTEGER, pay_cyc_cnt_s68 INTEGER, pay_cyc_mon_list_s68 INTEGER, pay_amt_s68 INTEGER, is_cashed_s68 INTEGER, cashed_amt_s68 INTEGER, is_uncashed_s68 INTEGER, uncashed_amt_s68 INTEGER, uncashed_code_s68 INTEGER, uncashed_reason_s68 TEXT, recom_s68 TEXT,
    is_pay_list_s69 INTEGER, pay_cyc_cnt_s69 INTEGER, pay_cyc_mon_list_s69 INTEGER, pay_amt_s69 INTEGER, is_cashed_s69 INTEGER, cashed_amt_s69 INTEGER, is_uncashed_s69 INTEGER, uncashed_amt_s69 INTEGER, uncashed_code_s69 INTEGER, uncashed_reason_s69 TEXT, recom_s69 TEXT,
    is_pay_list_s70 INTEGER, pay_cyc_cnt_s70 INTEGER, pay_cyc_mon_list_s70 INTEGER, pay_amt_s70 INTEGER, is_cashed_s70 INTEGER, cashed_amt_s70 INTEGER, is_uncashed_s70 INTEGER, uncashed_amt_s70 INTEGER, uncashed_code_s70 INTEGER, uncashed_reason_s70 TEXT, recom_s70 TEXT,
    is_pay_list_s71 INTEGER, pay_cyc_cnt_s71 INTEGER, pay_cyc_mon_list_s71 INTEGER, pay_amt_s71 INTEGER, is_cashed_s71 INTEGER, cashed_amt_s71 INTEGER, is_uncashed_s71 INTEGER, uncashed_amt_s71 INTEGER, uncashed_code_s71 INTEGER, uncashed_reason_s71 TEXT, recom_s71 TEXT,
    is_pay_list_s72 INTEGER, pay_cyc_cnt_s72 INTEGER, pay_cyc_mon_list_s72 INTEGER, pay_amt_s72 INTEGER, is_cashed_s72 INTEGER, cashed_amt_s72 INTEGER, is_uncashed_s72 INTEGER, uncashed_amt_s72 INTEGER, uncashed_code_s72 INTEGER, uncashed_reason_s72 TEXT, recom_s72 TEXT,
    is_pay_list_s73 INTEGER, pay_cyc_cnt_s73 INTEGER, pay_cyc_mon_list_s73 INTEGER, pay_amt_s73 INTEGER, is_cashed_s73 INTEGER, cashed_amt_s73 INTEGER, is_uncashed_s73 INTEGER, uncashed_amt_s73 INTEGER, uncashed_code_s73 INTEGER, uncashed_reason_s73 TEXT, recom_s73 TEXT,
    is_pay_list_s74 INTEGER, pay_cyc_cnt_s74 INTEGER, pay_cyc_mon_list_s74 INTEGER, pay_amt_s74 INTEGER, is_cashed_s74 INTEGER, cashed_amt_s74 INTEGER, is_uncashed_s74 INTEGER, uncashed_amt_s74 INTEGER, uncashed_code_s74 INTEGER, uncashed_reason_s74 TEXT, recom_s74 TEXT,
    is_pay_list_s75 INTEGER, pay_cyc_cnt_s75 INTEGER, pay_cyc_mon_list_s75 INTEGER, pay_amt_s75 INTEGER, is_cashed_s75 INTEGER, cashed_amt_s75 INTEGER, is_uncashed_s75 INTEGER, uncashed_amt_s75 INTEGER, uncashed_code_s75 INTEGER, uncashed_reason_s75 TEXT, recom_s75 TEXT,
    is_pay_list_s76 INTEGER, pay_cyc_cnt_s76 INTEGER, pay_cyc_mon_list_s76 INTEGER, pay_amt_s76 INTEGER, is_cashed_s76 INTEGER, cashed_amt_s76 INTEGER, is_uncashed_s76 INTEGER, uncashed_amt_s76 INTEGER, uncashed_code_s76 INTEGER, uncashed_reason_s76 TEXT, recom_s76 TEXT,
    total_pay_list INTEGER,
    total_pay_cyc_cnt INTEGER,
    total_pay_amt INTEGER,
    total_cashed_cnt INTEGER,
    total_cashed_amt INTEGER,
    total_uncashed_cnt INTEGER,
    total_uncashed_amt INTEGER,
    final_comments TEXT,
    data JSON
)`;

const allDbColumns = DB_COLUMNS_FOR_CREATION.replace(/[()]/g, "")
  .split(",")
  .map((s) => s.trim().split(/\s+/)[0])
  .filter(Boolean);

function initializeDatabase() {
    const db = new Database(getDbPath());
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS cash_disturbance ${DB_COLUMNS_FOR_CREATION};`);
        // Check for missing columns and add them
        const tableCols = db.prepare("PRAGMA table_info(cash_disturbance)").all().map((c: any) => c.name);
        allDbColumns.forEach(colName => {
            if (!tableCols.includes(colName)) {
                try {
                    db.exec(`ALTER TABLE cash_disturbance ADD COLUMN ${colName}`);
                } catch (error) {
                    console.warn(`Could not add column ${colName}:`, error);
                }
            }
        });

    } catch (e) {
        console.error("Database initialization failed:", e);
    }
    return db;
}

export async function POST(req: Request) {
  try {
    await fs.mkdir(getDataPath(), { recursive: true });
    const db = initializeDatabase();
    
    // ... rest of the API logic will go here
    
    db.close();
    return NextResponse.json({ message: "Database created/verified." });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
    try {
        await fs.mkdir(getDataPath(), { recursive: true });
        const db = new Database(getDbPath(), { fileMustExist: true });
        const records = db.prepare("SELECT * FROM cash_disturbance").all();
        db.close();
        return NextResponse.json(records);
    } catch (error: any) {
        if (error.code === "SQLITE_CANTOPEN") return NextResponse.json([]);
        return NextResponse.json({ error: "Failed to fetch cash disturbance data.", details: error.message }, { status: 500 });
    }
}
