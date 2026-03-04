const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, 'src', 'app', '(system-guard)', '(protected)', 'productos', 'components', 'create-producto-dialog.tsx');
let content1 = fs.readFileSync(file1, 'utf8');

// Simplificar CreateProductoDialog para que solo use CreateCategoriaDialog
// Buscaremos el bloque del select de categorías y el botón

const searchStr1 = `                  {categoriaId && (
                    <Button
                      type="button"
                      variant="outline"
                      title="Editar categoría seleccionada"
                      className="h-11 px-3 border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                      onClick={() => {
                        const cat = categorias.find(c => c.id.toString() === categoriaId);
                        if (cat) {
                          setEditCatId(cat.id);
                          setEditCatNombre(cat.nombre);
                          setEditCatColor((cat.color || "sky") as CategoryColorKey);
                          setEditCatDescuentos(Array.isArray((cat as any).descuentos) ? (cat as any).descuentos : []);
                          setIsEditandoCat(true);
                        }
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    title="Crear nueva categoría"
                    className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => { setIsCreandoNuevaCat(true); setCategoriaId(""); setNuevaCatColor("sky"); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>`;

const replaceStr1 = `                  <CreateCategoriaDialog
                    onCreated={() => {
                      apiService.getCategorias().then((data) => {
                        setCategorias(Array.isArray(data) ? data : []);
                      });
                    }}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        title="Administrar Categorías"
                        className="h-11 px-3 border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      >
                        <Layers className="h-4 w-4" />
                      </Button>
                    }
                  />`;

content1 = content1.replace(searchStr1, replaceStr1);

// Remover la lógica inline de "isEditandoCat" y "isCreandoNuevaCat" del render
// Es un bloque largo, usaremos regex o replace manual por lo más seguro:
const startRenderCat = `              {!isCreandoNuevaCat && !isEditandoCat ? (`
const endRenderCat = `                </div>
              )}`

const renderSelectOnly = `              <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={categoriaId} onValueChange={setCategoriaId}>
                      <SelectTrigger className="pl-9 h-11 bg-muted/30">
                        <SelectValue placeholder="Seleccionar categoría..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => {
                          const catColor = getCategoryColorByKey(cat.color);
                          return (
                            <SelectItem key={cat.id} value={cat.id.toString()}>
                              <span className="flex items-center gap-2">
                                <span className={cn("h-2 w-2 rounded-full shrink-0", catColor.dot)} />
                                {cat.nombre}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
${replaceStr1}
                </div>`;

const searchFullCatBlock1 = content1.substring(content1.indexOf(startRenderCat), content1.indexOf(endRenderCat) + endRenderCat.length + 18);
if (searchFullCatBlock1.includes("import { CreateCategoriaDialog }")) {
    // Already imported
} else if (content1.includes(startRenderCat)) {
    content1 = content1.replace(searchFullCatBlock1, renderSelectOnly);
    content1 = content1.replace(`import { DiscountTiersInline } from "./discount-tiers-inline";`, `import { DiscountTiersInline } from "./discount-tiers-inline";\nimport { CreateCategoriaDialog } from "./create-categoria-dialog";`)
}

// Limpiar imports unused (opcional) pero vital: asegurar que compila
fs.writeFileSync(file1, content1);


// REPETIR PARA EDIT DIALOG
const file2 = path.join(__dirname, 'src', 'app', '(system-guard)', '(protected)', 'productos', 'components', 'edit-producto-dialog.tsx');
let content2 = fs.readFileSync(file2, 'utf8');

const searchFullCatBlock2 = content2.substring(content2.indexOf(startRenderCat), content2.indexOf(endRenderCat, content2.indexOf(startRenderCat)) + endRenderCat.length + 900); // es más largo aquí
const endRenderIndex2 = content2.lastIndexOf(`                </div>
              )}`);

if (endRenderIndex2 > content2.indexOf(startRenderCat)) {
    const block2 = content2.substring(content2.indexOf(startRenderCat), endRenderIndex2 + 20);
    content2 = content2.replace(block2, renderSelectOnly);

    if (!content2.includes(`import { CreateCategoriaDialog }`)) {
        content2 = content2.replace(`import { DiscountTiersInline } from "./discount-tiers-inline";`, `import { DiscountTiersInline } from "./discount-tiers-inline";\nimport { CreateCategoriaDialog } from "./create-categoria-dialog";`)
    }
}

fs.writeFileSync(file2, content2);
console.log("Dialogos de producto modificados!");
