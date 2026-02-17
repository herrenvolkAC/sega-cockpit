console.log("🚀 Iniciando servidor debug...");

// Test 1: Importar Fastify
console.log("1️⃣ Importando Fastify...");
try {
  const Fastify = require("fastify");
  console.log("✅ Fastify importado correctamente");
  
  // Test 2: Crear instancia
  console.log("2️⃣ Creando instancia de Fastify...");
  const app = Fastify({
    logger: false, // Deshabilitar logger para ver si ese es el problema
  });
  console.log("✅ Instancia de Fastify creada");
  
  // Test 3: Configuración
  console.log("3️⃣ Cargando configuración...");
  try {
    const config = require("./config");
    console.log("✅ Configuración cargada:", { port: config.port });
  } catch (error) {
    console.error("❌ Error cargando configuración:", error);
  }
  
  // Test 4: Registrar ruta simple
  console.log("4️⃣ Registrando ruta simple...");
  app.get("/test", async (request: any, reply: any) => {
    return { message: "Server is working!", timestamp: new Date().toISOString() };
  });
  console.log("✅ Rota simple registrada");
  
  // Test 5: Iniciar servidor
  console.log("5️⃣ Iniciando servidor...");
  const start = async () => {
    try {
      await app.listen({ port: 3001, host: "0.0.0.0" });
      console.log("🎉 Servidor iniciado exitosamente en http://localhost:3001");
      console.log("📡 Probando ruta: http://localhost:3001/test");
    } catch (err) {
      console.error("❌ Error iniciando servidor:", err);
      process.exit(1);
    }
  };
  
  start();
  
} catch (error) {
  console.error("❌ Error importando Fastify:", error);
  process.exit(1);
}
