import { PrismaClient } from '@prisma/client';
import { UserRole, AssessmentStatus, QuestionType, DifficultyLevel, TimingMode, ProctoringMode } from '@racsemi/shared';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export async function seed() {
  console.log('🚀 Starting RACSEMI Assess database seed...');

  // 1. Create or get Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'racsemi' },
    update: {},
    create: {
      name: 'RACSEMI',
      slug: 'racsemi',
      logoUrl: '/brand/racsemi-logo.svg',
      settings: JSON.stringify({
        retentionDays: 30,
        enableIntegrity: true,
        primaryColor: '#2563eb'
      })
    }
  });
  console.log(`✅ Organization created/verified: ${org.name} (${org.id})`);

  // 2. Create Admin User
  const passwordHash = await bcrypt.hash('Admin@123456', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@racsemi.com' },
    update: {
      passwordHash,
      role: UserRole.SUPER_ADMIN
    },
    create: {
      email: 'admin@racsemi.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'RACSEMI',
      role: UserRole.SUPER_ADMIN,
      organizationId: org.id
    }
  });
  console.log(`✅ Admin user created: ${admin.email} (Password: Admin@123456)`);

  // 3. Create Assessment
  const assessmentSlug = 'software-developer-intern-assessment';
  const assessment = await prisma.assessment.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: assessmentSlug
      }
    },
    update: {},
    create: {
      organizationId: org.id,
      title: 'RACSEMI Software Developer Intern Assessment',
      slug: assessmentSlug,
      description: 'Official technical screening assessment for Software Developer Intern and technical campus recruitment.',
      role: 'Software Developer Intern',
      difficulty: DifficultyLevel.MEDIUM,
      timingMode: TimingMode.TOTAL_ASSESSMENT_TIMER,
      durationMinutes: 100,
      totalMarks: 100,
      passingPercentage: 60,
      maxAttempts: 1,
      randomizeQuestions: false,
      randomizeOptions: false,
      showResultToCandidate: false,
      integrityMonitoring: true,
      proctoringMode: ProctoringMode.BASIC,
      instructions: `Please read the following instructions carefully before starting:
1. Total duration is 100 minutes for 27 questions across 4 sections.
2. Section 1: Aptitude & Logical Reasoning (10 questions, 20 marks).
3. Section 2: Technical MCQs (15 questions, 30 marks).
4. Section 3: Coding Easy (1 question, 20 marks).
5. Section 4: Coding Medium (1 question, 30 marks).
6. Do not switch browser tabs or exit fullscreen mode. All suspicious integrity events will be logged.
7. Ensure a stable internet connection and webcam if requested.`,
      allowedLanguages: JSON.stringify(['python', 'javascript', 'typescript', 'cpp', 'java', 'go']),
      status: AssessmentStatus.ACTIVE,
      createdById: admin.id
    }
  });
  console.log(`✅ Assessment created: ${assessment.title}`);

  // 4. Create Sections
  // Clean existing sections & questions link if re-seeding
  await prisma.assessmentQuestion.deleteMany({ where: { assessmentId: assessment.id } });
  await prisma.assessmentSection.deleteMany({ where: { assessmentId: assessment.id } });

  const sec1 = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: 'Aptitude & Logical Reasoning',
      description: 'Quantitative aptitude, pattern recognition, and logical problem solving.',
      orderIndex: 0,
      durationMinutes: 20,
      marks: 20,
      questionCount: 10,
      isMandatory: true
    }
  });

  const sec2 = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: 'Technical MCQs',
      description: 'Core CS fundamentals: Data Structures, Algorithms, OS, DBMS, Networks, OOP, and Web.',
      orderIndex: 1,
      durationMinutes: 25,
      marks: 30,
      questionCount: 15,
      isMandatory: true
    }
  });

  const sec3 = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: 'Coding Easy',
      description: 'Fundamental algorithmic challenge to assess coding fluency.',
      orderIndex: 2,
      durationMinutes: 20,
      marks: 20,
      questionCount: 1,
      isMandatory: true
    }
  });

  const sec4 = await prisma.assessmentSection.create({
    data: {
      assessmentId: assessment.id,
      title: 'Coding Medium',
      description: 'Complex data structures and optimization challenge.',
      orderIndex: 3,
      durationMinutes: 35,
      marks: 30,
      questionCount: 1,
      isMandatory: true
    }
  });
  console.log('✅ 4 Assessment Sections created.');

  // 5. Seed Aptitude Questions (10 Questions, 2 marks each)
  const aptitudeQuestionsData = [
    {
      title: 'Time and Work Calculation',
      problemStatement: 'Worker A can complete a task in 12 days, and Worker B can complete the same task in 24 days. If they work together, in how many days will they finish the task?',
      options: [
        { key: 'A', text: '6 days', isCorrect: false },
        { key: 'B', text: '8 days', isCorrect: true },
        { key: 'C', text: '9 days', isCorrect: false },
        { key: 'D', text: '10 days', isCorrect: false }
      ],
      explanation: 'Combined 1-day work = 1/12 + 1/24 = 3/24 = 1/8. Hence, 8 days.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Speed, Distance, and Time',
      problemStatement: 'A train 150 meters long is traveling at a speed of 54 km/h. How many seconds will it take to cross an electric pole?',
      options: [
        { key: 'A', text: '8 seconds', isCorrect: false },
        { key: 'B', text: '10 seconds', isCorrect: true },
        { key: 'C', text: '12 seconds', isCorrect: false },
        { key: 'D', text: '15 seconds', isCorrect: false }
      ],
      explanation: 'Speed in m/s = 54 * (5/18) = 15 m/s. Time = Distance / Speed = 150 / 15 = 10 seconds.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Number Series Completion',
      problemStatement: 'Identify the next number in the sequence: 4, 9, 25, 49, 121, ?',
      options: [
        { key: 'A', text: '144', isCorrect: false },
        { key: 'B', text: '169', isCorrect: true },
        { key: 'C', text: '196', isCorrect: false },
        { key: 'D', text: '225', isCorrect: false }
      ],
      explanation: 'The sequence consists of squares of prime numbers: 2², 3², 5², 7², 11², and the next prime is 13, so 13² = 169.',
      category: 'Logical Reasoning',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Probability of Card Selection',
      problemStatement: 'One card is drawn at random from a standard deck of 52 cards. What is the probability of drawing either an Ace or a King?',
      options: [
        { key: 'A', text: '1/13', isCorrect: false },
        { key: 'B', text: '2/13', isCorrect: true },
        { key: 'C', text: '4/13', isCorrect: false },
        { key: 'D', text: '1/26', isCorrect: false }
      ],
      explanation: 'There are 4 Aces and 4 Kings = 8 cards. Probability = 8/52 = 2/13.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Profit and Loss Evaluation',
      problemStatement: 'An item is purchased for $80 and sold for $100. What is the profit percentage?',
      options: [
        { key: 'A', text: '20%', isCorrect: false },
        { key: 'B', text: '25%', isCorrect: true },
        { key: 'C', text: '30%', isCorrect: false },
        { key: 'D', text: '15%', isCorrect: false }
      ],
      explanation: 'Profit = 100 - 80 = 20. Profit % = (20 / 80) * 100 = 25%.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Syllogism and Logical Deduction',
      problemStatement: 'Statements: 1. All engineers are problem solvers. 2. Some problem solvers are leaders.\nConclusion I: Some engineers are leaders.\nConclusion II: All problem solvers are engineers.',
      options: [
        { key: 'A', text: 'Only Conclusion I follows', isCorrect: false },
        { key: 'B', text: 'Only Conclusion II follows', isCorrect: false },
        { key: 'C', text: 'Both follow', isCorrect: false },
        { key: 'D', text: 'Neither follows', isCorrect: true }
      ],
      explanation: 'Neither conclusion is guaranteed by the given premises.',
      category: 'Logical Reasoning',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Blood Relations Interpretation',
      problemStatement: 'Pointing to a photograph, David said, "She is the daughter of my grandfather\'s only son." How is the woman in the photograph related to David?',
      options: [
        { key: 'A', text: 'Mother', isCorrect: false },
        { key: 'B', text: 'Sister', isCorrect: true },
        { key: 'C', text: 'Aunt', isCorrect: false },
        { key: 'D', text: 'Daughter', isCorrect: false }
      ],
      explanation: "Grandfather's only son is David's father. The daughter of David's father is David's sister.",
      category: 'Logical Reasoning',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Ratio and Proportion',
      problemStatement: 'Two numbers are in the ratio 3:5. If 6 is added to each number, the ratio becomes 2:3. What is the larger number?',
      options: [
        { key: 'A', text: '20', isCorrect: false },
        { key: 'B', text: '30', isCorrect: true },
        { key: 'C', text: '40', isCorrect: false },
        { key: 'D', text: '50', isCorrect: false }
      ],
      explanation: 'Let numbers be 3x and 5x. (3x + 6)/(5x + 6) = 2/3 => 9x + 18 = 10x + 12 => x = 6. Larger number = 5x = 30.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Direction Sense Test',
      problemStatement: 'A person walks 5 km North, turns right and walks 4 km, then turns right again and walks 5 km. In which direction and distance is the person from the starting point?',
      options: [
        { key: 'A', text: '4 km East', isCorrect: true },
        { key: 'B', text: '4 km West', isCorrect: false },
        { key: 'C', text: '5 km East', isCorrect: false },
        { key: 'D', text: '9 km South', isCorrect: false }
      ],
      explanation: 'The person moves North (+5y), East (+4x), South (-5y). Net position is (4x, 0) = 4 km East.',
      category: 'Logical Reasoning',
      score: 2,
      negativeScore: 0.5
    },
    {
      title: 'Percentage and Mixture',
      problemStatement: 'A solution of 40 liters of milk and water contains 10% water. How much water must be added to make water 20% of the new solution?',
      options: [
        { key: 'A', text: '4 liters', isCorrect: false },
        { key: 'B', text: '5 liters', isCorrect: true },
        { key: 'C', text: '6 liters', isCorrect: false },
        { key: 'D', text: '8 liters', isCorrect: false }
      ],
      explanation: 'Pure milk = 36 liters (90%). In new mix, 36 liters = 80% => Total volume = 45 liters. Water added = 45 - 40 = 5 liters.',
      category: 'Aptitude',
      score: 2,
      negativeScore: 0.5
    }
  ];

  let aptOrder = 0;
  for (const qData of aptitudeQuestionsData) {
    const question = await prisma.question.create({
      data: {
        organizationId: org.id,
        title: qData.title,
        problemStatement: qData.problemStatement,
        questionType: QuestionType.MCQ_SINGLE,
        difficulty: DifficultyLevel.EASY,
        category: qData.category,
        tags: 'aptitude,recruitment,intern',
        score: qData.score,
        negativeScore: qData.negativeScore,
        explanation: qData.explanation,
        createdById: admin.id,
        options: {
          create: qData.options.map((opt, idx) => ({
            optionKey: opt.key,
            content: opt.text,
            isCorrect: opt.isCorrect,
            orderIndex: idx
          }))
        }
      }
    });

    await prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        sectionId: sec1.id,
        questionId: question.id,
        orderIndex: aptOrder++
      }
    });
  }
  console.log('✅ 10 Aptitude Questions seeded.');

  // 6. Seed Technical MCQs (15 Questions, 2 marks each)
  const techQuestionsData = [
    {
      title: 'Binary Search Tree Search Complexity',
      problemStatement: 'What is the worst-case time complexity of searching for an element in an unbalanced Binary Search Tree (BST)?',
      options: [
        { key: 'A', text: 'O(1)', isCorrect: false },
        { key: 'B', text: 'O(log N)', isCorrect: false },
        { key: 'C', text: 'O(N)', isCorrect: true },
        { key: 'D', text: 'O(N log N)', isCorrect: false }
      ],
      explanation: 'In the worst case (skewed tree), a BST degenerates into a linked list with O(N) search time.',
      category: 'Data Structures'
    },
    {
      title: 'Virtual Memory and Page Faults',
      problemStatement: 'In an Operating System, when does a page fault occur?',
      options: [
        { key: 'A', text: 'When a deadlock is detected in the process scheduler.', isCorrect: false },
        { key: 'B', text: 'When the requested page is not currently in physical RAM.', isCorrect: true },
        { key: 'C', text: 'When a process terminates unexpectedly.', isCorrect: false },
        { key: 'D', text: 'When disk memory is completely full.', isCorrect: false }
      ],
      explanation: 'A page fault trap occurs when a process attempts to access a page that is mapped in address space but not loaded in physical RAM.',
      category: 'Operating Systems'
    },
    {
      title: 'ACID Properties in Relational DBMS',
      problemStatement: 'Which ACID property ensures that transactions execute concurrently without seeing intermediate states of other transactions?',
      options: [
        { key: 'A', text: 'Atomicity', isCorrect: false },
        { key: 'B', text: 'Consistency', isCorrect: false },
        { key: 'C', text: 'Isolation', isCorrect: true },
        { key: 'D', text: 'Durability', isCorrect: false }
      ],
      explanation: 'Isolation guarantees concurrent transactions execute in a manner equivalent to serial execution.',
      category: 'DBMS'
    },
    {
      title: 'TCP vs UDP Protocols',
      problemStatement: 'Which of the following is a key characteristic of the UDP protocol compared to TCP?',
      options: [
        { key: 'A', text: 'Connection-oriented with guaranteed delivery', isCorrect: false },
        { key: 'B', text: 'Lower latency with no 3-way handshake or packet retransmission', isCorrect: true },
        { key: 'C', text: 'Built-in congestion control mechanism', isCorrect: false },
        { key: 'D', text: 'Guaranteed in-order packet arrival', isCorrect: false }
      ],
      explanation: 'UDP is connectionless and does not guarantee packet arrival or ordering, prioritizing low overhead and speed.',
      category: 'Computer Networks'
    },
    {
      title: 'HTTP Status Code 403 vs 401',
      problemStatement: 'What does the HTTP 403 Forbidden status code indicate?',
      options: [
        { key: 'A', text: 'The client has not provided authentication credentials.', isCorrect: false },
        { key: 'B', text: 'The client is authenticated but lacks permission to access the resource.', isCorrect: true },
        { key: 'C', text: 'The requested resource could not be found.', isCorrect: false },
        { key: 'D', text: 'The server encountered an unhandled runtime error.', isCorrect: false }
      ],
      explanation: '401 Unauthorized means unauthenticated, whereas 403 Forbidden means recognized identity but insufficient authorization.',
      category: 'Web Development'
    },
    {
      title: 'Object-Oriented Polymorphism',
      problemStatement: 'In OOP, which mechanism enables calling a derived class method through a base class reference at runtime?',
      options: [
        { key: 'A', text: 'Dynamic Dispatch (Runtime Polymorphism)', isCorrect: true },
        { key: 'B', text: 'Method Overloading', isCorrect: false },
        { key: 'C', text: 'Encapsulation', isCorrect: false },
        { key: 'D', text: 'Static Binding', isCorrect: false }
      ],
      explanation: 'Virtual methods and dynamic dispatch resolve overridden functions at runtime based on the actual object instance.',
      category: 'OOP'
    },
    {
      title: 'Hash Table Collision Resolution',
      problemStatement: 'Which collision resolution technique places all colliding elements in a linked list or dynamic array at the same bucket index?',
      options: [
        { key: 'A', text: 'Linear Probing', isCorrect: false },
        { key: 'B', text: 'Quadratic Probing', isCorrect: false },
        { key: 'C', text: 'Separate Chaining', isCorrect: true },
        { key: 'D', text: 'Double Hashing', isCorrect: false }
      ],
      explanation: 'Separate chaining maintains a list of entries at each hash table bucket.',
      category: 'Data Structures'
    },
    {
      title: 'QuickSort Average vs Worst Case',
      problemStatement: 'What are the Average-Case and Worst-Case time complexities of standard QuickSort?',
      options: [
        { key: 'A', text: 'Average: O(N log N), Worst: O(N log N)', isCorrect: false },
        { key: 'B', text: 'Average: O(N log N), Worst: O(N²)', isCorrect: true },
        { key: 'C', text: 'Average: O(N²), Worst: O(N²)', isCorrect: false },
        { key: 'D', text: 'Average: O(N), Worst: O(N log N)', isCorrect: false }
      ],
      explanation: 'When pivot splits elements evenly, time is O(N log N); when pivot is consistently the extreme element, time degrades to O(N²).',
      category: 'Algorithms'
    },
    {
      title: 'Database Indexing Mechanism',
      problemStatement: 'Why are B+ Trees predominantly used for database indexing over standard Hash Indexes?',
      options: [
        { key: 'A', text: 'B+ Trees provide O(1) point lookups.', isCorrect: false },
        { key: 'B', text: 'B+ Trees efficiently support range queries and ordered scans.', isCorrect: true },
        { key: 'C', text: 'B+ Trees consume zero disk storage.', isCorrect: false },
        { key: 'D', text: 'B+ Trees eliminate the need for primary keys.', isCorrect: false }
      ],
      explanation: 'B+ Tree leaf nodes are linked sequentially, making range scans (BETWEEN, >, <) extremely fast.',
      category: 'DBMS'
    },
    {
      title: 'Deadlock Necessary Conditions',
      problemStatement: 'Which of the following is NOT one of the 4 Coffman conditions required for a deadlock to occur?',
      options: [
        { key: 'A', text: 'Mutual Exclusion', isCorrect: false },
        { key: 'B', text: 'Hold and Wait', isCorrect: false },
        { key: 'C', text: 'Preemption Allowed', isCorrect: true },
        { key: 'D', text: 'Circular Wait', isCorrect: false }
      ],
      explanation: 'The condition is "No Preemption" (resources cannot be forcibly taken away). Preemption prevents deadlocks.',
      category: 'Operating Systems'
    },
    {
      title: 'JavaScript Event Loop Architecture',
      problemStatement: 'In JavaScript (V8/Node.js), what is the execution priority between Microtasks (Promises) and Macrotasks (setTimeout)?',
      options: [
        { key: 'A', text: 'Macrotasks execute before all pending Microtasks.', isCorrect: false },
        { key: 'B', text: 'Microtasks are drained completely before the next Macrotask executes.', isCorrect: true },
        { key: 'C', text: 'Both queues execute concurrently on separate OS threads.', isCorrect: false },
        { key: 'D', text: 'Execution order is entirely random.', isCorrect: false }
      ],
      explanation: 'The event loop processes all microtasks (Promise reactions, queueMicrotask) before picking the next macrotask.',
      category: 'Web Development'
    },
    {
      title: 'DNS Resolution Role',
      problemStatement: 'What is the primary role of the Domain Name System (DNS)?',
      options: [
        { key: 'A', text: 'Encrypting HTTP payload traffic', isCorrect: false },
        { key: 'B', text: 'Mapping human-readable domain names (e.g. racsemi.com) to IP addresses', isCorrect: true },
        { key: 'C', text: 'Assigning dynamic IP addresses to home routers', isCorrect: false },
        { key: 'D', text: 'Load balancing database read replicas', isCorrect: false }
      ],
      explanation: 'DNS serves as the internet phonebook, translating hostnames into routable IPv4/IPv6 addresses.',
      category: 'Computer Networks'
    },
    {
      title: 'Design Patterns - Singleton Pattern',
      problemStatement: 'What is the primary intent of the Singleton design pattern?',
      options: [
        { key: 'A', text: 'To allow an object to alter its behavior when internal state changes.', isCorrect: false },
        { key: 'B', text: 'To ensure a class has only one instance and provide a global point of access to it.', isCorrect: true },
        { key: 'C', text: 'To dynamically attach additional responsibilities to an object.', isCorrect: false },
        { key: 'D', text: 'To separate abstraction from implementation.', isCorrect: false }
      ],
      explanation: 'Singleton restricts instantiation of a class to one single instance.',
      category: 'OOP'
    },
    {
      title: 'SQL Normalization 3NF',
      problemStatement: 'A relational table is in Third Normal Form (3NF) if it is in 2NF and has:',
      options: [
        { key: 'A', text: 'No multi-valued attributes', isCorrect: false },
        { key: 'B', text: 'No partial dependencies on primary key', isCorrect: false },
        { key: 'C', text: 'No transitive functional dependencies for non-prime attributes', isCorrect: true },
        { key: 'D', text: 'At least three candidate keys', isCorrect: false }
      ],
      explanation: '3NF removes transitive dependencies (X -> Y and Y -> Z where X is key and Y is non-key).',
      category: 'DBMS'
    },
    {
      title: 'Graph Traversal Algorithms',
      problemStatement: 'Which algorithm is best suited for finding the shortest path on an unweighted graph?',
      options: [
        { key: 'A', text: 'Breadth-First Search (BFS)', isCorrect: true },
        { key: 'B', text: 'Depth-First Search (DFS)', isCorrect: false },
        { key: 'C', text: 'Prim’s Minimum Spanning Tree Algorithm', isCorrect: false },
        { key: 'D', text: 'Topological Sort', isCorrect: false }
      ],
      explanation: 'BFS explores neighbor vertices layer-by-layer, guaranteeing shortest path in unweighted graphs in O(V + E).',
      category: 'Algorithms'
    }
  ];

  let techOrder = 0;
  for (const qData of techQuestionsData) {
    const question = await prisma.question.create({
      data: {
        organizationId: org.id,
        title: qData.title,
        problemStatement: qData.problemStatement,
        questionType: QuestionType.MCQ_SINGLE,
        difficulty: DifficultyLevel.MEDIUM,
        category: qData.category,
        tags: 'technical,cs-fundamentals,developer',
        score: 2,
        negativeScore: 0.5,
        explanation: qData.explanation,
        createdById: admin.id,
        options: {
          create: qData.options.map((opt, idx) => ({
            optionKey: opt.key,
            content: opt.text,
            isCorrect: opt.isCorrect,
            orderIndex: idx
          }))
        }
      }
    });

    await prisma.assessmentQuestion.create({
      data: {
        assessmentId: assessment.id,
        sectionId: sec2.id,
        questionId: question.id,
        orderIndex: techOrder++
      }
    });
  }
  console.log('✅ 15 Technical MCQ Questions seeded.');

  // 7. Seed Coding Easy Question (Two Sum Target Pair)
  const codingEasyQ = await prisma.question.create({
    data: {
      organizationId: org.id,
      title: 'Target Pair Sum (Two Sum)',
      problemStatement: `Given an integer array \`nums\` and an integer \`target\`, find the 0-based indices of the two numbers such that they add up to \`target\`.

You may assume that each input has exactly one valid solution, and you may not use the same element twice. Return the indices sorted in ascending order separated by a space.

### Input Format:
- Line 1: An integer \`N\` (number of elements)
- Line 2: \`N\` space-separated integers representing \`nums\`
- Line 3: An integer \`target\`

### Output Format:
- Print the two 0-based indices separated by a space (e.g. \`0 1\`).`,
      questionType: QuestionType.CODING,
      difficulty: DifficultyLevel.EASY,
      category: 'Data Structures & Algorithms',
      tags: 'array,hash-map,two-pointers,easy',
      score: 20,
      negativeScore: 0,
      explanation: 'Use a hash map to store seen values and their indices. For each element x, check if (target - x) exists.',
      createdById: admin.id,
      codingDetails: {
        create: {
          inputFormat: 'Line 1: N\nLine 2: N space-separated integers\nLine 3: target',
          outputFormat: 'Two space-separated indices: i j',
          constraints: '2 <= N <= 10^5\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9',
          sampleCasesJson: JSON.stringify([
            {
              input: '4\n2 7 11 15\n9',
              output: '0 1',
              explanation: 'nums[0] + nums[1] = 2 + 7 = 9'
            },
            {
              input: '3\n3 2 4\n6',
              output: '1 2',
              explanation: 'nums[1] + nums[2] = 2 + 4 = 6'
            }
          ]),
          starterCodeJson: JSON.stringify({
            python: `import sys

def two_sum():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    n = int(input_data[0])
    nums = [int(x) for x in input_data[1:n+1]]
    target = int(input_data[n+1])
    
    # TODO: Write solution
    lookup = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in lookup:
            print(f"{lookup[diff]} {i}")
            return
        lookup[num] = i

if __name__ == '__main__':
    two_sum()
`,
            javascript: `const fs = require('fs');

function twoSum() {
    const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!tokens || tokens.length < 3) return;
    const n = parseInt(tokens[0], 10);
    const nums = tokens.slice(1, n + 1).map(Number);
    const target = parseInt(tokens[n + 1], 10);

    const map = new Map();
    for (let i = 0; i < n; i++) {
        const diff = target - nums[i];
        if (map.has(diff)) {
            console.log(map.get(diff) + " " + i);
            return;
        }
        map.set(nums[i], i);
    }
}

twoSum();
`,
            cpp: `#include <iostream>
#include <vector>
#include <unordered_map>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int n;
    if (!(cin >> n)) return 0;
    vector<long long> nums(n);
    for (int i = 0; i < n; i++) cin >> nums[i];
    long long target;
    cin >> target;

    unordered_map<long long, int> map;
    for (int i = 0; i < n; i++) {
        long long diff = target - nums[i];
        if (map.find(diff) != map.end()) {
            cout << map[diff] << " " << i << "\n";
            return 0;
        }
        map[nums[i]] = i;
    }
    return 0;
}
`,
            java: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws Exception {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        int n = sc.nextInt();
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) nums[i] = sc.nextLong();
        long target = sc.nextLong();

        Map<Long, Integer> map = new HashMap<>();
        for (int i = 0; i < n; i++) {
            long diff = target - nums[i];
            if (map.containsKey(diff)) {
                System.out.println(map.get(diff) + " " + i);
                return;
            }
            map.put(nums[i], i);
        }
    }
}
`
          }),
          testCases: {
            create: [
              {
                input: '4\n2 7 11 15\n9',
                expectedOutput: '0 1',
                isHidden: false,
                orderIndex: 0,
                scoreWeight: 0.2,
                explanation: 'Sample Case 1'
              },
              {
                input: '3\n3 2 4\n6',
                expectedOutput: '1 2',
                isHidden: false,
                orderIndex: 1,
                scoreWeight: 0.2,
                explanation: 'Sample Case 2'
              },
              {
                input: '2\n3 3\n6',
                expectedOutput: '0 1',
                isHidden: true,
                orderIndex: 2,
                scoreWeight: 0.2,
                explanation: 'Hidden Duplicate Values'
              },
              {
                input: '5\n-1 -2 -3 -4 -5\n-8',
                expectedOutput: '2 4',
                isHidden: true,
                orderIndex: 3,
                scoreWeight: 0.2,
                explanation: 'Hidden Negative Numbers'
              },
              {
                input: '6\n1000000000 5 20 30 1000000000 7\n2000000000',
                expectedOutput: '0 4',
                isHidden: true,
                orderIndex: 4,
                scoreWeight: 0.2,
                explanation: 'Hidden Large Values 64-bit'
              }
            ]
          }
        }
      }
    }
  });

  await prisma.assessmentQuestion.create({
    data: {
      assessmentId: assessment.id,
      sectionId: sec3.id,
      questionId: codingEasyQ.id,
      orderIndex: 0
    }
  });
  console.log('✅ 1 Coding Easy Question seeded with 5 test cases.');

  // 8. Seed Coding Medium Question (Longest Substring Without Repeating Characters)
  const codingMediumQ = await prisma.question.create({
    data: {
      organizationId: org.id,
      title: 'Longest Substring Without Repeating Characters',
      problemStatement: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.

### Input Format:
- A single line containing the string \`s\`.

### Output Format:
- A single integer denoting the length of the longest non-repeating substring.`,
      questionType: QuestionType.CODING,
      difficulty: DifficultyLevel.MEDIUM,
      category: 'Data Structures & Algorithms',
      tags: 'string,sliding-window,hash-table,medium',
      score: 30,
      negativeScore: 0,
      explanation: 'Use a sliding window with two pointers (left and right) and a map storing the last seen position of each character.',
      createdById: admin.id,
      codingDetails: {
        create: {
          inputFormat: 'A single line with string s',
          outputFormat: 'Integer representing length',
          constraints: '0 <= s.length <= 10^5\ns consists of English letters, digits, symbols and spaces.',
          sampleCasesJson: JSON.stringify([
            {
              input: 'abcabcbb',
              output: '3',
              explanation: 'The answer is "abc", with the length of 3.'
            },
            {
              input: 'bbbbb',
              output: '1',
              explanation: 'The answer is "b", with the length of 1.'
            },
            {
              input: 'pwwkew',
              output: '3',
              explanation: 'The answer is "wke", with the length of 3.'
            }
          ]),
          starterCodeJson: JSON.stringify({
            python: `import sys

def length_of_longest_substring():
    s = sys.stdin.read().rstrip('\\r\\n')
    if not s:
        print(0)
        return
    
    char_map = {}
    left = 0
    max_len = 0
    
    for right, char in enumerate(s):
        if char in char_map and char_map[char] >= left:
            left = char_map[char] + 1
        char_map[char] = right
        max_len = max(max_len, right - left + 1)
        
    print(max_len)

if __name__ == '__main__':
    length_of_longest_substring()
`,
            javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').replace(/[\\r\\n]+$/, '');
    if (!input) {
        console.log(0);
        return;
    }
    const map = new Map();
    let left = 0, maxLen = 0;
    for (let right = 0; right < input.length; right++) {
        const char = input[right];
        if (map.has(char) && map.get(char) >= left) {
            left = map.get(char) + 1;
        }
        map.set(char, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    console.log(maxLen);
}

solve();
`,
            cpp: `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string s;
    if (!getline(cin, s)) {
        cout << 0 << "\n";
        return 0;
    }

    vector<int> lastIndex(256, -1);
    int left = 0, maxLen = 0;
    for (int right = 0; right < (int)s.length(); right++) {
        unsigned char c = (unsigned char)s[right];
        if (lastIndex[c] >= left) {
            left = lastIndex[c] + 1;
        }
        lastIndex[c] = right;
        maxLen = max(maxLen, right - left + 1);
    }
    cout << maxLen << "\n";
    return 0;
}
`
          }),
          testCases: {
            create: [
              {
                input: 'abcabcbb',
                expectedOutput: '3',
                isHidden: false,
                orderIndex: 0,
                scoreWeight: 0.2,
                explanation: 'Sample Case 1'
              },
              {
                input: 'bbbbb',
                expectedOutput: '1',
                isHidden: false,
                orderIndex: 1,
                scoreWeight: 0.2,
                explanation: 'Sample Case 2'
              },
              {
                input: 'pwwkew',
                expectedOutput: '3',
                isHidden: true,
                orderIndex: 2,
                scoreWeight: 0.2,
                explanation: 'Hidden Overlapping Characters'
              },
              {
                input: 'abcdefghijklmnopqrstuvwxyz',
                expectedOutput: '26',
                isHidden: true,
                orderIndex: 3,
                scoreWeight: 0.2,
                explanation: 'Hidden All Unique Alphabet'
              },
              {
                input: 'tmmzuxt',
                expectedOutput: '5',
                isHidden: true,
                orderIndex: 4,
                scoreWeight: 0.2,
                explanation: 'Hidden Complex Sliding Window'
              }
            ]
          }
        }
      }
    }
  });

  await prisma.assessmentQuestion.create({
    data: {
      assessmentId: assessment.id,
      sectionId: sec4.id,
      questionId: codingMediumQ.id,
      orderIndex: 0
    }
  });
  console.log('✅ 1 Coding Medium Question seeded with 5 test cases.');

  // 9. Seed 5 Sample Candidates and Invitations with Tokens
  const candidatesData = [
    { name: 'Rahul Sharma', email: 'rahul.sharma@example.com', phone: '+91 98765 43210', identifier: 'CAND-001', token: 'racsemi-demo-token-1' },
    { name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91 98765 43211', identifier: 'CAND-002', token: 'racsemi-demo-token-2' },
    { name: 'Ananya Iyer', email: 'ananya.iyer@example.com', phone: '+91 98765 43212', identifier: 'CAND-003', token: 'racsemi-demo-token-3' },
    { name: 'Vikram Singh', email: 'vikram.singh@example.com', phone: '+91 98765 43213', identifier: 'CAND-004', token: 'racsemi-demo-token-4' },
    { name: 'Sneha Rao', email: 'sneha.rao@example.com', phone: '+91 98765 43214', identifier: 'CAND-005', token: 'racsemi-demo-token-5' }
  ];

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 days valid

  for (const cData of candidatesData) {
    const candidate = await prisma.candidate.upsert({
      where: {
        organizationId_email: {
          organizationId: org.id,
          email: cData.email
        }
      },
      update: {
        name: cData.name,
        phone: cData.phone,
        candidateIdentifier: cData.identifier
      },
      create: {
        organizationId: org.id,
        name: cData.name,
        email: cData.email,
        phone: cData.phone,
        candidateIdentifier: cData.identifier,
        tags: 'intern-2026,campus-batch-1'
      }
    });

    const invitation = await prisma.invitation.upsert({
      where: {
        assessmentId_candidateId: {
          assessmentId: assessment.id,
          candidateId: candidate.id
        }
      },
      update: {
        token: cData.token,
        expiresAt: expiryDate
      },
      create: {
        assessmentId: assessment.id,
        candidateId: candidate.id,
        token: cData.token,
        expiresAt: expiryDate
      }
    });

    console.log(`👤 Candidate seeded: ${candidate.name} -> Token: ${invitation.token}`);
  }

  console.log('\n✨ Database seeding successfully completed!');
  console.log('----------------------------------------------------');
  console.log('Admin Email:     admin@racsemi.com');
  console.log('Admin Password:  Admin@123456');
  console.log('Demo Candidate:  http://localhost:3000/candidate/assessment/racsemi-demo-token-1');
  console.log('----------------------------------------------------\n');
}

if (require.main === module) {
  seed()
    .catch((e) => {
      console.error('❌ Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
