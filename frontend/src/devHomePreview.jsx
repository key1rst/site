import React from "react";
import { demoProducts } from "./mockData";

export default function DevHomePreview({ ProductCard, navigate }) {
  return (
    <div className="product-grid">
      {demoProducts.slice(0, 3).map((item) => (
        <ProductCard key={item.slug} item={item} navigate={navigate} />
      ))}
    </div>
  );
}
