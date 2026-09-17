const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function run() {
  try {
    const data = await prisma.assessment.findMany({ select: { id: true, title: true, isProctored: true } });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
