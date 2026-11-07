(function () {
  const directory = document.getElementById("artisanDirectory");
  const status = document.getElementById("directoryStatus");
  const config = window.ROSABEL_CONFIG || {};
  const key = config.supabaseAnonKey || config.publishableKey || "";

  if (!directory || !status || !config.supabaseUrl || !key || !window.supabase?.createClient) {
    status.textContent = "Rosabel ya tiene su espacio. Para cargar nuevas tiendas, vuelve a intentarlo cuando haya conexión.";
    return;
  }

  const supabase = window.supabase.createClient(config.supabaseUrl, key);

  function createProfileCard(profile) {
    const card = document.createElement("article");
    card.className = "artisan-card";

    if (profile.photo_url) {
      const image = document.createElement("img");
      image.className = "artisan-photo";
      image.src = profile.photo_url;
      image.alt = `Retrato de ${profile.artisan_name}`;
      image.loading = "lazy";
      card.append(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "artisan-photo artisan-photo-placeholder";
      placeholder.setAttribute("aria-hidden", "true");
      placeholder.textContent = profile.artisan_name.trim().charAt(0).toLocaleUpperCase("es");
      card.append(placeholder);
    }

    const info = document.createElement("div");
    info.className = "artisan-info";
    const label = document.createElement("span");
    label.className = "artisan-label";
    label.textContent = "Espacio individual";
    const shop = document.createElement("h3");
    shop.textContent = profile.shop_name;
    const byline = document.createElement("p");
    byline.textContent = `${profile.artisan_name} · ${profile.location}`;
    byline.className = "artisan-summary";
    const link = document.createElement("a");
    link.className = "button button-primary";
    link.href = `espacio-artesana.html?slug=${encodeURIComponent(profile.slug)}`;
    link.textContent = "Visitar su espacio";
    link.setAttribute("aria-label", `Visitar el espacio de ${profile.artisan_name}`);
    info.append(label, shop, byline, link);
    card.append(info);
    return card;
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("artisan_profiles")
      .select("slug, shop_name, artisan_name, location, photo_url")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("No se pudieron cargar los espacios de las artesanas.", error);
      status.textContent = "Ahora no se pudieron cargar otras tiendas. Rosabel sigue disponible.";
      return;
    }

    (data || []).filter((profile) => profile.slug !== "rosabel").forEach((profile) => {
      directory.append(createProfileCard(profile));
    });

    const total = (data || []).filter((profile) => profile.slug !== "rosabel").length;
    status.textContent = total
      ? `Hay ${total + 1} espacios individuales disponibles. Cada tienda tiene su propia historia y catálogo.`
      : "Rosabel es el primer espacio publicado. Cada artesana puede crear aquí su propia tienda independiente.";
  }

  loadProfiles().catch((error) => {
    console.warn("No se pudieron cargar los espacios de las artesanas.", error);
    status.textContent = "Ahora no se pudieron cargar otras tiendas. Rosabel sigue disponible.";
  });
})();
