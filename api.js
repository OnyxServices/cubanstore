import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://cgjpjnekolqfdxnangca.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnanBqbmVrb2xxZmR4bmFuZ2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MTk1MTIsImV4cCI6MjA4MzQ5NTUxMn0.rSTaIfj67gSGKiInEZDyaNyroPio1bXhVL4a1YFXfl0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* CATEGORÍAS */
export async function getCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createCategory(name, image_url = null) {
  const { error } = await supabase.from("categories").insert([{ name, image_url }]);
  if (error) throw error;
}

export async function deleteCategory(id) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

/* PRODUCTOS */
export async function getAllProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProduct(data) {
  const { error } = await supabase.from("products").insert([data]);
  if (error) throw error;
}

export async function updateProduct(id, fields) {
  const { error } = await supabase.from("products").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

/* STORAGE */
export async function uploadImage(bucket, file, path) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}