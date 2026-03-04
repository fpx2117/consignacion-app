const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, 'src', 'app', 'api', 'categorias', 'route.ts');
let content1 = fs.readFileSync(file1, 'utf8');

// POST
content1 = content1.replace(
    `
    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        ...(color && { color }),
        ...(descuentos && { descuentos }),
      },
    });`,
    `
    const sucursalIdHeader = req.headers.get("x-sucursal-id");
    const sucursalId = sucursalIdHeader ? Number(sucursalIdHeader) : 1;

    const nuevaCategoria = await prisma.categoria.create({
      data: {
        nombre: nombre.trim(),
        sucursalId,
        ...(color && { color }),
        ...(descuentos && { descuentos }),
      },
    });`
);

// GET
content1 = content1.replace(
    `// GET: Obtener todas las categorías ordenadas por nombre
export async function GET() {
  try {
    const categorias = await prisma.categoria.findMany({
      orderBy: { nombre: "asc" },
    });`,
    `// GET: Obtener todas las categorías ordenadas por nombre
export async function GET(req: NextRequest) {
  try {
    const sucursalIdHeader = req.headers.get("x-sucursal-id");
    const sucursalId = sucursalIdHeader ? Number(sucursalIdHeader) : 1;

    const categorias = await prisma.categoria.findMany({
      where: { sucursalId },
      orderBy: { nombre: "asc" },
    });`
);

fs.writeFileSync(file1, content1);

const file2 = path.join(__dirname, 'src', 'app', 'api', 'categorias', '[id]', 'route.ts');
let content2 = fs.readFileSync(file2, 'utf8');

content2 = content2.replace(
    `    const productosVinculados = await prisma.producto.count({
      where: { categoriaId: categoriaId },
    });

    if (productosVinculados > 0) {
      return NextResponse.json(
        { error: "No se puede eliminar: hay productos usando esta categoría" },
        { status: 400 }
      );
    }

    await prisma.categoria.delete({`,
    `    await prisma.producto.updateMany({
      where: { categoriaId: categoriaId },
      data: { categoriaId: null },
    });

    await prisma.categoria.delete({`
);

fs.writeFileSync(file2, content2);
console.log("Archivos modificados");
