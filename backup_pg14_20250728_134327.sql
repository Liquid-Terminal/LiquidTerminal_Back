--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.18 (Ubuntu 14.18-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: yaugourt
--

CREATE TYPE public."UserRole" AS ENUM (
    'USER',
    'MODERATOR',
    'ADMIN'
);


ALTER TYPE public."UserRole" OWNER TO yaugourt;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."Category" (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Category" OWNER TO yaugourt;

--
-- Name: Category_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."Category_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Category_id_seq" OWNER TO yaugourt;

--
-- Name: Category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."Category_id_seq" OWNED BY public."Category".id;


--
-- Name: EducationalCategory; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."EducationalCategory" (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdBy" integer NOT NULL
);


ALTER TABLE public."EducationalCategory" OWNER TO yaugourt;

--
-- Name: EducationalCategory_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."EducationalCategory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."EducationalCategory_id_seq" OWNER TO yaugourt;

--
-- Name: EducationalCategory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."EducationalCategory_id_seq" OWNED BY public."EducationalCategory".id;


--
-- Name: EducationalResource; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."EducationalResource" (
    id integer NOT NULL,
    url character varying(500) NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "addedBy" integer NOT NULL,
    "linkPreviewId" text
);


ALTER TABLE public."EducationalResource" OWNER TO yaugourt;

--
-- Name: EducationalResourceCategory; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."EducationalResourceCategory" (
    id integer NOT NULL,
    "resourceId" integer NOT NULL,
    "categoryId" integer NOT NULL,
    "assignedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedBy" integer
);


ALTER TABLE public."EducationalResourceCategory" OWNER TO yaugourt;

--
-- Name: EducationalResourceCategory_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."EducationalResourceCategory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."EducationalResourceCategory_id_seq" OWNER TO yaugourt;

--
-- Name: EducationalResourceCategory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."EducationalResourceCategory_id_seq" OWNED BY public."EducationalResourceCategory".id;


--
-- Name: EducationalResource_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."EducationalResource_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."EducationalResource_id_seq" OWNER TO yaugourt;

--
-- Name: EducationalResource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."EducationalResource_id_seq" OWNED BY public."EducationalResource".id;


--
-- Name: Project; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."Project" (
    id integer NOT NULL,
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title character varying(255) NOT NULL,
    "desc" character varying(255) NOT NULL,
    logo character varying(255) NOT NULL,
    twitter character varying(255),
    discord character varying(255),
    telegram character varying(255),
    website character varying(255),
    "categoryId" integer,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Project" OWNER TO yaugourt;

--
-- Name: Project_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."Project_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Project_id_seq" OWNER TO yaugourt;

--
-- Name: Project_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."Project_id_seq" OWNED BY public."Project".id;


--
-- Name: ReadList; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."ReadList" (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500),
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" integer NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."ReadList" OWNER TO yaugourt;

--
-- Name: ReadListItem; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."ReadListItem" (
    id integer NOT NULL,
    "readListId" integer NOT NULL,
    "resourceId" integer NOT NULL,
    "addedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    notes text,
    "order" integer
);


ALTER TABLE public."ReadListItem" OWNER TO yaugourt;

--
-- Name: ReadListItem_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."ReadListItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ReadListItem_id_seq" OWNER TO yaugourt;

--
-- Name: ReadListItem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."ReadListItem_id_seq" OWNED BY public."ReadListItem".id;


--
-- Name: ReadList_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."ReadList_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."ReadList_id_seq" OWNER TO yaugourt;

--
-- Name: ReadList_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."ReadList_id_seq" OWNED BY public."ReadList".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    "privyUserId" text NOT NULL,
    name character varying(255),
    email character varying(255),
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL
);


ALTER TABLE public."User" OWNER TO yaugourt;

--
-- Name: UserWallet; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."UserWallet" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "walletId" integer NOT NULL,
    "addedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name character varying(255)
);


ALTER TABLE public."UserWallet" OWNER TO yaugourt;

--
-- Name: UserWallet_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."UserWallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."UserWallet_id_seq" OWNER TO yaugourt;

--
-- Name: UserWallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."UserWallet_id_seq" OWNED BY public."UserWallet".id;


--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."User_id_seq" OWNER TO yaugourt;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: Wallet; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public."Wallet" (
    id integer NOT NULL,
    address character varying(255) NOT NULL,
    "addedAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    name character varying(255)
);


ALTER TABLE public."Wallet" OWNER TO yaugourt;

--
-- Name: Wallet_id_seq; Type: SEQUENCE; Schema: public; Owner: yaugourt
--

CREATE SEQUENCE public."Wallet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public."Wallet_id_seq" OWNER TO yaugourt;

--
-- Name: Wallet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: yaugourt
--

ALTER SEQUENCE public."Wallet_id_seq" OWNED BY public."Wallet".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO yaugourt;

--
-- Name: link_previews; Type: TABLE; Schema: public; Owner: yaugourt
--

CREATE TABLE public.link_previews (
    id text NOT NULL,
    url character varying(500) NOT NULL,
    title character varying(255),
    description character varying(500),
    image character varying(500),
    "siteName" character varying(100),
    favicon character varying(500),
    "createdAt" timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.link_previews OWNER TO yaugourt;

--
-- Name: Category id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Category" ALTER COLUMN id SET DEFAULT nextval('public."Category_id_seq"'::regclass);


--
-- Name: EducationalCategory id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalCategory" ALTER COLUMN id SET DEFAULT nextval('public."EducationalCategory_id_seq"'::regclass);


--
-- Name: EducationalResource id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResource" ALTER COLUMN id SET DEFAULT nextval('public."EducationalResource_id_seq"'::regclass);


--
-- Name: EducationalResourceCategory id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResourceCategory" ALTER COLUMN id SET DEFAULT nextval('public."EducationalResourceCategory_id_seq"'::regclass);


--
-- Name: Project id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Project" ALTER COLUMN id SET DEFAULT nextval('public."Project_id_seq"'::regclass);


--
-- Name: ReadList id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadList" ALTER COLUMN id SET DEFAULT nextval('public."ReadList_id_seq"'::regclass);


--
-- Name: ReadListItem id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadListItem" ALTER COLUMN id SET DEFAULT nextval('public."ReadListItem_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Name: UserWallet id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."UserWallet" ALTER COLUMN id SET DEFAULT nextval('public."UserWallet_id_seq"'::regclass);


--
-- Name: Wallet id; Type: DEFAULT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Wallet" ALTER COLUMN id SET DEFAULT nextval('public."Wallet_id_seq"'::regclass);


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."Category" (id, name, description, "createdAt", "updatedAt") FROM stdin;
117	Build	This a build	2025-07-25 14:29:03.672	2025-07-25 14:29:03.672
\.


--
-- Data for Name: EducationalCategory; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."EducationalCategory" (id, name, description, "createdAt", "createdBy") FROM stdin;
1	HIP-2: Hyperliquidity	\N	2025-07-19 13:23:29.64	525
2	HiP-3: Builder-Deployed Perpetuals	\N	2025-07-19 13:23:53.917	525
3	HIP-1: Native token standard	\N	2025-07-19 13:23:53.917	525
4	HyperEVM	\N	2025-07-19 13:24:19.059	525
5	Builder codes	builder codes blabla	2025-07-26 11:45:27.907	525
6	whitelabel	\N	2025-07-26 11:46:22.356	525
\.


--
-- Data for Name: EducationalResource; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."EducationalResource" (id, url, "createdAt", "addedBy", "linkPreviewId") FROM stdin;
1	https://x.com/Yaugourt/status/1883070449417949380	2025-07-19 13:25:27.293	525	\N
2	https://www.blocmates.com/articles/hip-3-explained-why-hyperliquid-will-flip-binance	2025-07-19 13:25:55.805	525	\N
3	https://x.com/0xOmnia/status/1929537413660983568	2025-07-19 13:27:24.29	525	\N
4	https://skygg.substack.com/i/158855966/hyperevm	2025-07-19 13:28:06.037	525	\N
\.


--
-- Data for Name: EducationalResourceCategory; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."EducationalResourceCategory" (id, "resourceId", "categoryId", "assignedAt", "assignedBy") FROM stdin;
2	2	2	2025-07-19 13:27:09.568	\N
3	3	3	2025-07-19 13:27:41.339	\N
4	4	4	2025-07-19 13:28:17.322	\N
1	1	1	2025-07-19 13:25:42.332	\N
\.


--
-- Data for Name: Project; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."Project" (id, "createdAt", title, "desc", logo, twitter, discord, telegram, website, "categoryId", "updatedAt") FROM stdin;
\.


--
-- Data for Name: ReadList; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."ReadList" (id, name, description, "createdAt", "updatedAt", "userId", "isPublic") FROM stdin;
15	rzaerzer	azerazre	2025-07-23 20:24:09.207	2025-07-23 20:24:09.207	525	f
19	test	salut toi	2025-07-24 14:29:28.304	2025-07-24 14:29:28.304	525	f
20	test	test	2025-07-26 13:52:58.363	2025-07-26 13:52:58.363	1497	t
21	testons	testong	2025-07-26 13:53:51.467	2025-07-26 13:53:51.467	1497	f
\.


--
-- Data for Name: ReadListItem; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."ReadListItem" (id, "readListId", "resourceId", "addedAt", "isRead", notes, "order") FROM stdin;
8	19	4	2025-07-26 13:44:11.856	f	Added from https://skygg.substack.com/i/158855966/hyperevm	0
9	15	2	2025-07-26 13:45:05.282	f	Added from https://www.blocmates.com/articles/hip-3-explained-why-hyperliquid-will-flip-binance	0
13	21	3	2025-07-26 13:53:57.665	f	Added from https://x.com/0xOmnia/status/1929537413660983568	0
14	20	4	2025-07-26 13:54:55.975	f	Added from https://skygg.substack.com/i/158855966/hyperevm	0
15	20	2	2025-07-26 13:56:22.174	f	Added from https://www.blocmates.com/articles/hip-3-explained-why-hyperliquid-will-flip-binance	1
17	21	1	2025-07-26 13:59:07.262	f	Added from https://x.com/Yaugourt/status/1883070449417949380	1
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."User" (id, "privyUserId", name, email, "createdAt", verified, role) FROM stdin;
525	did:privy:cm4e9aj9w053i12x9ss569zdj	Yaugourt	\N	2025-07-02 14:02:37.685	f	ADMIN
409	did:privy:cmc95sdno004qjl0nb7ae5hhc	encyclochain	\N	2025-06-23 13:55:15.669	f	USER
315	did:privy:cmbqa0chx002mlb0mfh4h73nv	liquidterminal	\N	2025-06-10 08:45:48.538	f	USER
1497	did:privy:cm4ecaoqy011tvpkpzi99qko5	0xDeka	\N	2025-07-25 10:23:03.818	f	USER
\.


--
-- Data for Name: UserWallet; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."UserWallet" (id, "userId", "walletId", "addedAt", name) FROM stdin;
46	409	105	2025-07-02 13:58:31.271	aminelezgeg
64	525	104	2025-07-24 12:26:19.18	rre
65	525	105	2025-07-24 13:59:16.193	pour
66	525	108	2025-07-26 09:21:32.915	osi
\.


--
-- Data for Name: Wallet; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public."Wallet" (id, address, "addedAt", name) FROM stdin;
102	0x1cba6c6ead0b6221b379f3ec1a56f47f798eedae	2025-06-09 13:35:24.787	dksjds
103	0x0ad1763dddd2aa9284b3828c19eed0a1960f362b	2025-06-10 08:23:24.003	ldfsdf
104	0x45d26f28196d226497130c4bac709d808fed4029	2025-06-10 09:19:40.244	lkrejkre
105	0x129e08091ddafcbf328c622972192ec6afc670f6	2025-07-01 20:38:45.593	kfkjfkd
106	0x36d492d8c1d72843f627fb689af293d8f1de7248	2025-07-12 11:18:31.288	dsqqsdsq
107	0x079f56bfd27f71cbd278c27c7b121e7ef180a5be	2025-07-20 14:25:21.412	qDFQSDFQSDF
108	0x4b66f4048a0a90fd5ff44abbe5d68332656b78b8	2025-07-26 09:21:32.901	osi
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0e8810d8-0ef9-4b99-a1fb-e22864c2d179	4153b80bd2d52070765951f82c0d051d9257cfa28514e84b4d5c15424306e3c6	2025-03-06 23:02:25.161977+01	20241206093549_init	\N	\N	2025-03-06 23:02:25.089792+01	1
0c0c2a39-3312-4d33-b0c1-c864b043c131	35037a0eca8e80fe5b3dfb6f935636c0cb0626c05240780c9f5d8eb8fffe9dc6	2025-03-06 23:02:25.956961+01	20250306220225_add_name_to_wallet	\N	\N	2025-03-06 23:02:25.924774+01	1
16ab9314-8f80-4197-b0c7-2a5d4425c135	d1ef4a8a92d700245bf59ec88686b4451e2c69c32e23d809d52c04f6935e501f	2025-04-28 21:51:03.573266+02	20250428195103_add_user_wallet_table	\N	\N	2025-04-28 21:51:03.53628+02	1
ebc92f74-5f6a-4461-8a22-85cc051aa4a2	96eecc0b48b57d25a1282143b85a0eed353f376e1ad70d0d841c21cb61af5b15	2025-04-28 22:52:18.065999+02	20250428205217_add_name_to_user_wallet	\N	\N	2025-04-28 22:52:18.059779+02	1
a33a9922-9fb3-4d03-b1d6-56f21e2c3ed3	b08bd21ba68b83f953e2ee876cdfe2ee91f888607a9dd258a7b4b9e60c88afc1	2025-06-29 16:22:08.07477+02	20250629142207_add_educational_resources_remove_auction	\N	\N	2025-06-29 16:22:08.026304+02	1
02c287a7-9bd8-476d-b611-acf2d9a56879	515acbf1e912368e5769984a5cc44f8d1e8a788d24716c3576b724d2a4301d43	2025-07-17 21:49:37.98367+02	20250717194937_remove_watchlist_models	\N	\N	2025-07-17 21:49:37.969132+02	1
80802a30-8b16-4baf-b551-c5867a3b30da	dde0450ed3bae7b5f118e23caae55330c0219a9ba665494c0b64b2773583b925	2025-07-17 21:51:20.789536+02	20250717195120_remove_watchlist_and_resource_models	\N	\N	2025-07-17 21:51:20.783414+02	1
b9527f6e-302b-437a-823e-4983a387ec16	cbcb892218709cad407ab8717206abc26673d87f14852a24c67e4acc494ac095	2025-07-19 19:03:30.869331+02	20250719170330_add_read_lists	\N	\N	2025-07-19 19:03:30.821509+02	1
2fe83e1c-a821-4391-9d44-8676aa85bab0	863b0e23ae1152602174277dc6ea37cffafb499e627e61d6e3641a167f39d8f8	2025-07-21 01:40:34.917467+02	20250720234034_add_link_preview	\N	\N	2025-07-21 01:40:34.839386+02	1
20869d01-8075-4717-ba95-7408ab120f59	9f79582b658317434fcc92552ae49f35c689e7c5a275566ab3e69021775d4fb4	2025-07-25 15:13:02.270538+02	20250725131302_add_user_roles	\N	\N	2025-07-25 15:13:02.243445+02	1
\.


--
-- Data for Name: link_previews; Type: TABLE DATA; Schema: public; Owner: yaugourt
--

COPY public.link_previews (id, url, title, description, image, "siteName", favicon, "createdAt", "updatedAt") FROM stdin;
cmdkaabmi000lipms2u09lm4p	https://x.com/venturetwins/status/1948771505783144641	Justine Moore (@venturetwins) on X	This may be the coolest emergent capability I've seen in a video model.\n\nVeo 3 can take a series of text instructions added to an image frame, understand them, and execute in sequence.\n\nPrompt was "immediately delete instructions in white on the first frame and execute in order"	https://pbs.twimg.com/amplify_video_thumb/1948770476287041536/img/oWGQXBa20mIFIJp4.jpg:large	X (formerly Twitter)	https://x.com/favicon.ico	2025-07-26 13:26:21.787	2025-07-26 13:26:22.178
cmdd5rkh9001gipim03svgcg9	https://x.com/Yaugourt/status/1883070449417949380	Yaugourt (@Yaugourt) on X	1. What Is HIP-2 , HYPER LIQUIDITY?\n\nHIP-2 is a built-in mechanism on the Hyperliquid L1 that makes sure new tokens (created under HIP-1) always have some buy and sell orders in their order book.\n\nThink of it as an automatic market maker that lives inside the blockchain. It	https://pbs.twimg.com/media/GiH5femW4AAUsY7.jpg:large	X (formerly Twitter)	https://x.com/favicon.ico	2025-07-21 13:45:25.101	2025-07-27 16:15:01.515
cmdd5rkgp001fipim53e3awf8	https://x.com/0xOmnia/status/1929537413660983568	Omnia.hl π (@0xOmnia) on X	What is HIP-1?\n\nOne of the most underrated parts about Hyperliquid is the ability to permissionlessly launch your own token with a fully onchain orderbook.\n\nThis means you win an auction with payment in $HYPE.\n\nNo politics. No under the table deals. No nonsense.	https://pbs.twimg.com/media/GscXfr5WIAEsZRo.jpg:large	X (formerly Twitter)	https://x.com/favicon.ico	2025-07-21 13:45:25.081	2025-07-27 16:15:01.528
cmdka8oxt000fipms0et1f1xj	https://x.com/tunahorse21/status/1948511782588264917	tuna🍣 (@tunahorse21) on X	I Love Claude Code	https://pbs.twimg.com/media/GwqAma5XcAArWJ6.jpg:large	X (formerly Twitter)	https://x.com/favicon.ico	2025-07-26 13:25:05.729	2025-07-26 13:25:06.24
cmdcbu5ev0001ipyx1tbqqacs	https://skygg.substack.com/i/158855966/hyperevm	Beginner/Intermediate Guide to HyperCore and HyperEVM	Hyperliquid = HyperCore + HyperEVM	https://substackcdn.com/image/fetch/$s_!SK9V!,w_1200,h_600,c_fill,f_jpg,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F9bc490f1-ab14-4127-a880-c1fa698426f9_2740x1656.jpeg	skygg.substack.com	https://skygg.substack.com/favicon.ico	2025-07-20 23:47:37.063	2025-07-27 16:15:03.521
cmdd58f700000ipimfnhd41nb	https://www.blocmates.com/articles/hip-3-explained-why-hyperliquid-will-flip-binance	HIP-3 Explained: Why Hyperliquid Will Flip Binance | Hyperliquid Improvement Proposal 3 (HIP-3) Overview  | blocmates	\N	https://cdn.prod.website-files.com/64e2d11370e5eca9bb7f2087/6852867e0590fe240ea6c7bc_hip-3%20explained.webp	www.blocmates.com	https://www.blocmates.com/favicon.ico	2025-07-21 13:30:31.789	2025-07-27 16:15:04.359
\.


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."Category_id_seq"', 117, true);


--
-- Name: EducationalCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."EducationalCategory_id_seq"', 6, true);


--
-- Name: EducationalResourceCategory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."EducationalResourceCategory_id_seq"', 8, true);


--
-- Name: EducationalResource_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."EducationalResource_id_seq"', 9, true);


--
-- Name: Project_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."Project_id_seq"', 2217, true);


--
-- Name: ReadListItem_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."ReadListItem_id_seq"', 17, true);


--
-- Name: ReadList_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."ReadList_id_seq"', 21, true);


--
-- Name: UserWallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."UserWallet_id_seq"', 66, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."User_id_seq"', 1698, true);


--
-- Name: Wallet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: yaugourt
--

SELECT pg_catalog.setval('public."Wallet_id_seq"', 108, true);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: EducationalCategory EducationalCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalCategory"
    ADD CONSTRAINT "EducationalCategory_pkey" PRIMARY KEY (id);


--
-- Name: EducationalResourceCategory EducationalResourceCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResourceCategory"
    ADD CONSTRAINT "EducationalResourceCategory_pkey" PRIMARY KEY (id);


--
-- Name: EducationalResource EducationalResource_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResource"
    ADD CONSTRAINT "EducationalResource_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: ReadListItem ReadListItem_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadListItem"
    ADD CONSTRAINT "ReadListItem_pkey" PRIMARY KEY (id);


--
-- Name: ReadList ReadList_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadList"
    ADD CONSTRAINT "ReadList_pkey" PRIMARY KEY (id);


--
-- Name: UserWallet UserWallet_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Wallet Wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Wallet"
    ADD CONSTRAINT "Wallet_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: link_previews link_previews_pkey; Type: CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public.link_previews
    ADD CONSTRAINT link_previews_pkey PRIMARY KEY (id);


--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);


--
-- Name: EducationalCategory_name_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "EducationalCategory_name_key" ON public."EducationalCategory" USING btree (name);


--
-- Name: EducationalResourceCategory_resourceId_categoryId_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "EducationalResourceCategory_resourceId_categoryId_key" ON public."EducationalResourceCategory" USING btree ("resourceId", "categoryId");


--
-- Name: Project_title_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "Project_title_key" ON public."Project" USING btree (title);


--
-- Name: ReadListItem_readListId_resourceId_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "ReadListItem_readListId_resourceId_key" ON public."ReadListItem" USING btree ("readListId", "resourceId");


--
-- Name: UserWallet_userId_walletId_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "UserWallet_userId_walletId_key" ON public."UserWallet" USING btree ("userId", "walletId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_privyUserId_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "User_privyUserId_key" ON public."User" USING btree ("privyUserId");


--
-- Name: Wallet_address_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX "Wallet_address_key" ON public."Wallet" USING btree (address);


--
-- Name: link_previews_url_key; Type: INDEX; Schema: public; Owner: yaugourt
--

CREATE UNIQUE INDEX link_previews_url_key ON public.link_previews USING btree (url);


--
-- Name: EducationalCategory EducationalCategory_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalCategory"
    ADD CONSTRAINT "EducationalCategory_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EducationalResourceCategory EducationalResourceCategory_assignedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResourceCategory"
    ADD CONSTRAINT "EducationalResourceCategory_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EducationalResourceCategory EducationalResourceCategory_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResourceCategory"
    ADD CONSTRAINT "EducationalResourceCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."EducationalCategory"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EducationalResourceCategory EducationalResourceCategory_resourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResourceCategory"
    ADD CONSTRAINT "EducationalResourceCategory_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES public."EducationalResource"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EducationalResource EducationalResource_addedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResource"
    ADD CONSTRAINT "EducationalResource_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EducationalResource EducationalResource_linkPreviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."EducationalResource"
    ADD CONSTRAINT "EducationalResource_linkPreviewId_fkey" FOREIGN KEY ("linkPreviewId") REFERENCES public.link_previews(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Project Project_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReadListItem ReadListItem_readListId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadListItem"
    ADD CONSTRAINT "ReadListItem_readListId_fkey" FOREIGN KEY ("readListId") REFERENCES public."ReadList"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReadListItem ReadListItem_resourceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadListItem"
    ADD CONSTRAINT "ReadListItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES public."EducationalResource"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReadList ReadList_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."ReadList"
    ADD CONSTRAINT "ReadList_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserWallet UserWallet_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserWallet UserWallet_walletId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: yaugourt
--

ALTER TABLE ONLY public."UserWallet"
    ADD CONSTRAINT "UserWallet_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES public."Wallet"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

