const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 

async function run() {
  try {
    await prisma.assessment.updateMany({ data: { isProctored: true } });
    console.log("Updated all assessments to isProctored: true");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
