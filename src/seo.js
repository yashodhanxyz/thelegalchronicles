const PUBLISHER = 'The Legal Chronicles';
const ORIGIN = 'https://thelegalchronicles.com';
export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
export function pageGraph({title, description, canonical, article, image, person, breadcrumbs = []}) {
  const publisher = `${ORIGIN}/#organization`;
  const webpage = {'@type':'WebPage','@id':`${canonical}#webpage`,url:canonical,name:title,description,inLanguage:'en',isPartOf:{'@id':`${ORIGIN}/#website`}};
  const graph = [
    {'@type':'Organization','@id':publisher,name:PUBLISHER,url:ORIGIN},
    {'@type':'WebSite','@id':`${ORIGIN}/#website`,url:ORIGIN,name:PUBLISHER,publisher:{'@id':publisher},inLanguage:'en'},
    webpage,
  ];
  if (breadcrumbs.length) {
    graph.push({'@type':'BreadcrumbList','@id':`${canonical}#breadcrumbs`,itemListElement:breadcrumbs.map((b,i)=>({'@type':'ListItem',position:i+1,name:b.name,item:b.url}))});
    webpage.breadcrumb={'@id':`${canonical}#breadcrumbs`};
  }
  if (article) {
    const authorId = `${new URL(canonical).origin}/authors/yashodhan-deshmukh#person`;
    graph.push({'@type':'Person','@id':authorId,name:article.human_author || 'Yashodhan Deshmukh',url:authorId.split('#')[0]});
    const entity = {'@type':'Article','@id':`${canonical}#article`,headline:article.title,description:article.description,url:canonical,mainEntityOfPage:{'@id':webpage['@id']},author:{'@id':authorId},publisher:{'@id':publisher},inLanguage:'en',datePublished:article.published_at,dateModified:article.updated_at || article.published_at,citation:new URL(article.metadata.judgment_path,new URL(canonical).origin).href};
    if (image) entity.image = new URL(image.src,canonical).href;
    graph.push(entity);webpage.mainEntity={'@id':entity['@id']};
  }
  if (person) { const details=typeof person==='string'?{name:person}:person; graph.push({'@type':'Person','@id':`${canonical}#person`,name:details.name,...(details.description?{description:details.description}:{}),url:canonical});webpage.mainEntity={'@id':`${canonical}#person`}; }
  return {'@context':'https://schema.org','@graph':graph};
}
