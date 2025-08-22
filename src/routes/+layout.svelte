<script>
  import '../app.css';
</script>

<div class="min-h-screen">
  <header class="bg-white shadow-sm border-b">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-4">
        <div class="flex items-center">
          <h1 class="text-2xl font-bold text-gray-900">
            <a href="/" class="hover:text-blue-600 transition-colors">OpenYourMath</a>
          </h1>
        </div>
        <nav class="flex space-x-6">
          <a href="/" class="text-gray-600 hover:text-gray-900 transition-colors">Recherche</a>
          <a href="/browse" class="text-gray-600 hover:text-gray-900 transition-colors">Parcourir</a>
        </nav>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <slot />
  </main>

  <footer class="mt-16 bg-gray-100 border-t">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <p class="text-center text-gray-600">OpenYourMath V2 - Exercices de mathématiques</p>
    </div>
  </footer>
</div>
