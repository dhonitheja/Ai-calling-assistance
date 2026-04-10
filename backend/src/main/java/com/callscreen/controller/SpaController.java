package com.callscreen.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

/**
 * Forwards all non-API routes to React's index.html
 * so client-side navigation works when served from Spring Boot.
 */
@Controller
public class SpaController {

    @RequestMapping(value = {
        "/",
        "/{path:[^\\.]*}",
        "/{path:^(?!api|actuator).*$}/**"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
