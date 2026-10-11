// DEMO CONTENT ONLY. Replace this module with approved company and catalog data.
import oilImage from "./assets/mock-beaker.png";
import greaseImage from "./assets/greases.png";
import lubricantImage from "./assets/industrial-lubricants.png";
import baseImage from "./assets/base-oils.png";
import processImage from "./assets/process-oils.png";

export const demoCategories = [
  {
    name: "Base Oils",
    count: 8,
    image: baseImage,
    description:
      "Group I, II, III and specialty base oils for diverse applications.",
  },
  {
    name: "Industrial Lubricants",
    count: 6,
    image: lubricantImage,
    description:
      "High-performance lubricants for industrial and marine applications.",
  },
  {
    name: "Greases",
    count: 4,
    image: greaseImage,
    description:
      "Premium greases for extreme conditions and long service life.",
  },
  {
    name: "Related Products",
    count: 3,
    image: processImage,
    description:
      "Process oils, white oils, transformer oils and other specialty products.",
  },
];

export const demoProducts = [
  {
    slug: "base-oil-sn150",
    name: "SN150",
    fullName: "Base Oil SN150",
    category: "Base Oils",
    group: "Group I Base Oil",
    grade: "SN150",
    origin: "UAE",
    quantity: 500,
    packing: "ISO Tank",
    status: "In Stock",
    application: "Automotive",
    image: oilImage,
    description:
      "Wide range of applications with excellent stability and high performance.",
  },
  {
    slug: "base-oil-sn500",
    name: "SN500",
    fullName: "Base Oil SN500",
    category: "Base Oils",
    group: "Group I Base Oil",
    grade: "SN500",
    origin: "S. Korea",
    quantity: 1000,
    packing: "Flexitank",
    status: "In Stock",
    application: "Industrial",
    image: oilImage,
    description:
      "High viscosity index and low volatility. Suitable for industrial applications.",
  },
  {
    slug: "base-oil-sn600",
    name: "SN600",
    fullName: "Base Oil SN600",
    category: "Base Oils",
    group: "Group I Base Oil",
    grade: "SN600",
    origin: "Singapore",
    quantity: 300,
    packing: "Drum",
    status: "In Stock",
    application: "Marine",
    image: oilImage,
    description:
      "Premium quality for high-performance lubricants. Low pour point.",
  },
  {
    slug: "bright-stock",
    name: "Bright Stock",
    fullName: "Bright Stock",
    category: "Base Oils",
    group: "Premium Base Oil",
    grade: "BS150",
    origin: "UAE",
    quantity: 200,
    packing: "Drum",
    status: "Limited",
    application: "Industrial",
    image: oilImage,
    description:
      "Premium base oil with excellent thermal and oxidation stability.",
  },
  {
    slug: "hydraulic-oil-46",
    name: "Hydraulic Oil 46",
    fullName: "Hydraulic Oil 46",
    category: "Industrial Lubricants",
    group: "Industrial Lubricant",
    grade: "ISO VG 46",
    origin: "China",
    quantity: 1200,
    packing: "IBC",
    status: "In Stock",
    application: "Industrial",
    image: oilImage,
    description:
      "High performance hydraulic oil with anti-wear properties and excellent stability.",
  },
  {
    slug: "lithium-grease-ep2",
    name: "Lithium Grease EP2",
    fullName: "Lithium Grease EP2",
    category: "Greases",
    group: "Grease",
    grade: "EP2",
    origin: "UAE",
    quantity: 100,
    packing: "Drum",
    status: "In Stock",
    application: "Automotive",
    image: greaseImage,
    description:
      "Premium lithium grease for extreme conditions and long service life.",
  },
];

export const demoPackaging = [
  { name: "Drum", detail: "170kg / 200kg", position: "0%" },
  { name: "Flexitank", detail: "20ft / 24,000L", position: "25%" },
  { name: "IBC", detail: "1,000L", position: "50%" },
  { name: "ISO Tank", detail: "20ft / 24,000L", position: "75%" },
  { name: "Bulk Shipment", detail: "Custom volumes", position: "100%" },
];

export const demoBenefits = [
  {
    icon: "shield",
    title: "Assured Quality",
    text: "Strict quality control and third-party inspection.",
  },
  {
    icon: "globe",
    title: "Global Logistics",
    text: "Reliable worldwide shipping and documentation.",
  },
  {
    icon: "package",
    title: "Flexible Packaging",
    text: "Drums, IBC, flexitank, ISO tank and bulk.",
  },
  {
    icon: "clock",
    title: "Fast Quotations",
    text: "Competitive pricing with quick response times.",
  },
  {
    icon: "headset",
    title: "Technical Support",
    text: "Expert guidance for your applications.",
  },
];

export const demoTeam = [
  {
    slug: "james-carter",
    name: "James Carter",
    role: "Chief Executive Officer",
    position: "0%",
    bio: "Sample profile for the company leadership role. Replace with an approved biography and photograph.",
  },
  {
    slug: "sophia-nguyen",
    name: "Sophia Nguyen",
    role: "Head of Global Trade",
    position: "33.333%",
    bio: "Sample profile for the global trade team. Replace with an approved biography and photograph.",
  },
  {
    slug: "daniel-kim",
    name: "Daniel Kim",
    role: "Technical Director",
    position: "66.667%",
    bio: "Sample profile for technical product support. Replace with an approved biography and photograph.",
  },
  {
    slug: "emma-wilson",
    name: "Emma Wilson",
    role: "Head of Client Relations",
    position: "100%",
    bio: "Sample profile for client relations. Replace with an approved biography and photograph.",
  },
];

export const demoInsights = [
  {
    title: "Base Oil Market Outlook 2024",
    category: "Industry insights",
    image: baseImage,
    description:
      "Key trends, supply dynamics and forecasts for global base oils.",
  },
  {
    title: "Choosing the Right Industrial Lubricant",
    category: "Technical guide",
    image: lubricantImage,
    description: "A practical guide for industrial applications.",
  },
  {
    title: "Global Logistics in the Lubricants Industry",
    category: "Supply chain",
    image: processImage,
    description: "How to ensure safe and efficient delivery worldwide.",
  },
];

export const demoSpecs = [
  ["Kinematic Viscosity @ 40°C", "ASTM D445", "99.5 – 110.5", "cSt"],
  ["Kinematic Viscosity @ 100°C", "ASTM D445", "11.0 – 13.0", "cSt"],
  ["Viscosity Index", "ASTM D2270", "≥ 95", "—"],
  ["Density @ 15°C", "ASTM D4052", "0.850 – 0.870", "g/cm³"],
  ["Flash Point (COC)", "ASTM D92", "≥ 220", "°C"],
  ["Pour Point", "ASTM D97", "≤ -12", "°C"],
  ["Color (Saybolt)", "ASTM D156", "≥ +30", "—"],
  ["Sulfur Content", "ASTM D4294", "≤ 0.03", "% wt"],
];

export const demoFaqs = [
  {
    question: "What is the minimum order quantity (MOQ)?",
    answer:
      "The demo minimum is 1,000 MT for SN500. Confirm the actual quantity with the sales team.",
  },
  {
    question: "What packaging options are available?",
    answer:
      "Drum, flexitank, IBC, ISO tank, and bulk are shown as sample options.",
  },
  {
    question: "Can you provide a sample and COA before shipment?",
    answer:
      "This is a sample workflow; document availability needs confirmation.",
  },
  {
    question: "What are the available Incoterms?",
    answer:
      "FOB, CIF, CFR, and DAP are shown as sample terms to discuss during quotation.",
  },
  {
    question: "How long is the typical lead time?",
    answer:
      "The sample estimate is 7–14 days and must be verified for a real order.",
  },
  {
    question: "Do you provide technical support?",
    answer:
      "Technical support is represented in this demo and should be confirmed before launch.",
  },
];

export const demoCompany = {
  name: "PETROVEX",
  heroDescription:
    "PETROVEX is a trusted global supplier of base oils and industrial lubricants, connecting reliable supply with industrial progress worldwide.",
  story:
    "Founded with a clear vision to support global industry, PETROVEX has grown into a reliable international partner for base oils and industrial lubricants. We bridge supply and demand across continents, helping our customers operate more efficiently and sustainably.",
  mission:
    "To deliver reliable, high-quality base oils and industrial lubricants through global sourcing, efficient logistics and exceptional service, creating long-term value for our partners worldwide.",
  presenceDescription:
    "We supply base oils and industrial lubricants to customers in over 50 countries, working with refineries, traders, distributors and end-users across key industrial markets.",
  presencePoints: [
    "Established supplier network",
    "Local market knowledge",
    "Reliable logistics partners",
    "Growing presence in emerging markets",
  ],
  quality: [
    {
      title: "Quality Control",
      text: "Strict quality control throughout the supply chain to ensure consistent product quality.",
      icon: "flask",
    },
    {
      title: "Third-Party Inspection",
      text: "Support for SGS, Bureau Veritas and other international inspection companies.",
      icon: "shield",
    },
    {
      title: "Full Documentation",
      text: "COA, MSDS, TDS and all export documentation provided.",
      icon: "file",
    },
    {
      title: "International Compliance",
      text: "Products meet major international specifications and industry standards.",
      icon: "shield",
    },
  ],
  values: [
    ["Integrity", "Honest, transparent and responsible business practices."],
    ["Partnership", "Long-term relationships and mutual growth."],
    ["Customer Focus", "Your success drives our success."],
    ["Sustainability", "Supporting a cleaner, more efficient future."],
    [
      "Global Mindset",
      "Connecting markets, people and opportunities worldwide.",
    ],
  ],
  metrics: [
    {
      icon: "globe",
      number: "50+",
      label: "Countries Supplied",
      detail: "Across Asia, Middle East, Africa, Europe and the Americas.",
    },
    {
      icon: "package",
      number: "1,000,000+ MT",
      label: "Annual Supply Volume",
      detail: "Reliable and consistent supply to global markets.",
    },
    {
      icon: "gear",
      number: "10+",
      label: "Years of Experience",
      detail: "Deep industry expertise and market knowledge.",
    },
    {
      icon: "clock",
      number: "< 24 Hours",
      label: "Average Response Time",
      detail: "Fast and professional customer support.",
    },
    {
      icon: "truck",
      number: "Global Reach",
      label: "Multi-Modal Logistics",
      detail: "Via sea, road and rail to meet your needs worldwide.",
    },
  ],
  offices: [
    {
      name: "Head Office – Dubai, UAE",
      address: "Office 3401, Silver Tower\nBusiness Bay, Dubai, UAE",
      phone: "+971 4 123 4567",
      email: "sales@petrovex.com",
      position: "0%",
    },
    {
      name: "Asia Office – Singapore",
      address: "10 Marina Boulevard\nSingapore 018983",
      phone: "+65 6123 4567",
      email: "asia@petrovex.com",
      position: "50%",
    },
    {
      name: "Europe Office – London, UK",
      address: "Level 24, 40 Bank Street\nCanary Wharf, London E14 5NR",
      phone: "+44 20 7123 4567",
      email: "europe@petrovex.com",
      position: "100%",
    },
  ],
  milestones: [
    { year: "2014", text: "Company founded in Dubai, UAE" },
    { year: "2016", text: "Expanded supply to Asia and Africa" },
    { year: "2018", text: "Reached 20+ countries" },
    { year: "2020", text: "Surpassed 500,000 MT supply" },
    { year: "2022", text: "Opened Asia office in Singapore" },
    { year: "2024", text: "50+ countries worldwide" },
    { year: "2025", text: "Continuing our growth" },
  ],
  certifications: [
    "ISO 9001",
    "ISO 14001",
    "ISO 45001",
    "SGS",
    "BUREAU VERITAS",
    "intertek",
    "TÜV Rheinland",
  ],
};

export const demoHomeStats = [
  { icon: "globe", value: "50+", label: "Countries Supplied" },
  { icon: "package", value: "1,000+", label: "Happy Clients" },
  { icon: "clock", value: "10+", label: "Years of Experience" },
];

export const demoOverviewRows = [
  ["Origin", "South Korea / UAE"],
  ["Grade", "SN500 (Group II)"],
  ["MOQ", "1,000 MT"],
  ["Loading Port", "UAE (Jebel Ali) / South Korea"],
  ["Packing", "Drum, Flexitank, IBC, ISO Tank"],
  ["Lead Time", "7 – 14 days"],
  ["Incoterms", "FOB, CIF, CFR, DAP (Negotiable)"],
];
