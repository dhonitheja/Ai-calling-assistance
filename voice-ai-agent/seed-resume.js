const fs = require('fs');
const path = require('path');

const resumeText = `SAI TEJA RAGULA
Java Full Stack Developer | Spring Boot | React | Microservices | AWS
PROFESSIONAL SUMMARY: Java Full Stack Developer with 5+ years of experience building enterprise web applications. Strong backend expertise in Java, Spring Boot, and microservices architecture with frontend proficiency in React and TypeScript. Skilled in building RESTful and GraphQL APIs, event-driven systems with Kafka, and cloud-native deployments on AWS and GCP. Experienced with CI/CD pipelines, Docker, Kubernetes, and infrastructure as code. Proficient in SQL and NoSQL databases including PostgreSQL, MongoDB, and Redis. Strong communicator who thrives in Agile environments. AWS Certified Solutions Architect with proven ability to deliver high-quality, scalable solutions.
TECHNICAL SKILLS: Backend: Java 8/11/17, Spring Boot, Spring MVC, Spring Security, Spring Data, Hibernate, JPA, Microservices, Python, Node.js. Frontend: React, TypeScript, JavaScript (ES6+), Redux, Next.js, Angular, HTML5, CSS3, Tailwind CSS, Responsive Design. APIs: RESTful APIs, GraphQL, API Design, OpenAPI/Swagger, OAuth 2.0, JWT, Microservices Architecture. Databases: PostgreSQL, MySQL, Oracle, MongoDB, Redis, Elasticsearch, SQL, NoSQL. Cloud & DevOps: AWS (EC2, EKS, Lambda, S3, RDS), GCP, Docker, Kubernetes, Jenkins, Terraform, Git. Messaging: Apache Kafka, Event-Driven Architecture, Message Queues. AI/GenAI: LLM Integration, Claude, Gemini, ChatGPT, Vertex AI, RAG, Prompt Engineering.
EXPERIENCE: Frontier Communications | Allen, TX | Java Full Stack Developer | January 2023 – Present. Develop enterprise web applications using Java/Spring Boot backend and React/TypeScript frontend. Build and maintain RESTful and GraphQL APIs. Design and implement microservices architecture with event-driven processing using Apache Kafka. Deploy cloud-native applications on AWS using Docker, Kubernetes, and CI/CD pipelines. Work with PostgreSQL, MongoDB, caching via Redis. Achieve 90%+ code coverage through unit and integration testing with JUnit. Implement OAuth 2.0 and JWT.
EXPERIENCE: Wipro | India | Software Engineer | January 2022 – July 2022. Built full stack applications using Java/Spring Boot backend and React frontend. Developed RESTful APIs and microservices. Worked with PostgreSQL and MongoDB databases. Deployed applications on AWS cloud with Docker and CI/CD automation.
EXPERIENCE: Intellativ India Private Limited | India | Software Engineer | December 2020 – January 2022. Developed Java-based web applications with Spring Boot and React. Built event-driven microservices using Apache Kafka for real-time processing. Created RESTful APIs (OAuth 2.0, JWT). Deployed containerized applications on Kubernetes with CI/CD pipelines. Applied TDD practices ensuring code quality.
PROJECTS: Wealthix – Full Stack Financial Platform. Tech: Java, Spring Boot, React, Next.js, PostgreSQL, Kafka, Plaid API, AWS. Developed full stack platform with Java/Spring Boot and React. Built RESTful APIs and integrated third-party services (Plaid, Stripe). Implemented event-driven architecture with Kafka. Deployed on AWS with Kubernetes.
PROJECTS: AI Financial Co-Pilot – Enterprise Web Application. Built full stack application with Java backend and React frontend. Created real-time dashboard. Deployed on cloud infrastructure with CI/CD pipeline.
EDUCATION: Master of Science in Computer Science, Governor's State University. Bachelor of Technology in Computer Science, St. Peter's Engineering College.
CERTIFICATIONS: AWS Certified Solutions Architect – Associate (2025). Oracle Cloud Infrastructure AI Foundations Associate (2024). IBM Prompt Engineering for Everyone (2024). Cisco Cybersecurity Essentials.`;

async function seed() {
    const chunks = resumeText.split('\n').map(c => c.trim()).filter(c => c.length > 5);
    
    try {
        const res = await fetch("http://localhost:3001/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chunks,
                metadata: { source: "resume-sync", role: "candidate", author: "Sai Teja Ragula" }
            })
        });
        const data = await res.json();
        console.log("Pinecone Seeding Complete!", data);
    } catch (e) {
        console.error("Error seeding:", e);
    }
}
seed();
